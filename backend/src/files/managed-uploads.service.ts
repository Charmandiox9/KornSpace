import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { addAbortSignal, type Readable } from 'node:stream';
import { FilesService } from './files.service';
import { UploadRegistryService, uploadLeaseMs, type UploadRecord } from './upload-registry.service';
import type { MultipartFile, MultipartUpload, UploadFileResult, UploadLifecycle, UploadOperationResponse } from './file.types';

export const uploadPartSizeBytes = 16 * 1024 * 1024;

@Injectable()
export class ManagedUploadsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ManagedUploadsService.name);
  private readonly active = new Map<string, AbortController>();
  private recoveryTimer?: ReturnType<typeof setInterval>;
  private recovering = false;

  constructor(private readonly files: FilesService, private readonly registry: UploadRegistryService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.recoveryTimer = setInterval(() => { void this.recoverPending(); }, 10000);
    this.recoveryTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.recoveryTimer);
    this.active.forEach((controller) => controller.abort());
  }

  private key(ownerId: string, operationId: string): string { return `${ownerId}:${operationId}`; }

  async upload(source: Readable, name: string, contentType: string, sizeBytes: number, ownerId: string, operationId: string, signal: AbortSignal, folderId: string | null = null, replaceFileId?: string): Promise<UploadFileResult> {
    const record = await this.registry.begin(ownerId, operationId, false);
    return this.finishUpload(record, signal, (lifecycle) =>
      this.files.upload(source, name, contentType, sizeBytes, ownerId, { ...lifecycle, folderId, replaceFileId }));
  }

  async startMultipart(ownerId: string, operationId: string, file: MultipartFile): Promise<number> {
    await this.files.checkUploadTarget(file, ownerId);
    const record = await this.registry.begin(ownerId, operationId, false, {
      ...file, replaceFileId: file.replaceFileId ?? undefined, partSizeBytes: uploadPartSizeBytes, parts: [], busy: true,
    });
    await this.runMultipartStep(record, undefined, async () => {
      const uploadId = await this.files.startMultipart(record.fileId, file.contentType);
      const state = await this.registry.update(ownerId, operationId, (current) => ['uploading', 'cancelling'].includes(current.phase) ? {
        ...current, multipart: { ...this.getMultipart(current), uploadId, busy: false }, leaseUntil: Date.now() + uploadLeaseMs,
      } : current);
      if (state.phase !== 'uploading') {
        if (state.multipart?.uploadId !== uploadId) await this.files.abortMultipart(record.fileId, uploadId);
        throw new ConflictException('La carga fue cancelada.');
      }
    });
    return uploadPartSizeBytes;
  }

  async uploadPart(ownerId: string, operationId: string, partNumber: number, contentLength: number, source: Readable, signal: AbortSignal): Promise<void> {
    const record = await this.claimMultipart(ownerId, operationId, (file) => {
      const expected = Math.min(file.partSizeBytes, file.sizeBytes - (partNumber - 1) * file.partSizeBytes);
      if (partNumber !== file.parts.length + 1 || expected <= 0 || contentLength !== expected) {
        throw new BadRequestException('La parte no coincide con el orden o el tamaño esperado.');
      }
    });
    const file = this.getMultipart(record);
    await this.runMultipartStep(record, signal, async (activeSignal) => {
      activeSignal.throwIfAborted();
      const body = Buffer.allocUnsafe(contentLength);
      let received = 0;
      for await (const chunk of addAbortSignal(activeSignal, source) as AsyncIterable<unknown>) {
        if (!Buffer.isBuffer(chunk) || received + chunk.length > body.length) throw new BadRequestException('La parte supera el tamaño declarado.');
        chunk.copy(body, received);
        received += chunk.length;
      }
      if (received !== body.length) throw new BadRequestException('La parte está incompleta.');
      const tag = await this.files.uploadPart(record.fileId, file.uploadId!, partNumber, body, activeSignal);
      const state = await this.registry.update(ownerId, operationId, (current) => current.phase === 'uploading'
        ? { ...current, multipart: { ...file, parts: [...file.parts, tag], busy: false }, leaseUntil: Date.now() + uploadLeaseMs } : current);
      if (state.phase !== 'uploading') throw new ConflictException('La carga fue cancelada.');
    });
  }

  async completeMultipart(ownerId: string, operationId: string, signal: AbortSignal): Promise<UploadFileResult> {
    const record = await this.claimMultipart(ownerId, operationId, (file) => {
      if (file.parts.length !== Math.ceil(file.sizeBytes / file.partSizeBytes)) throw new BadRequestException('Faltan partes por subir.');
    });
    return this.finishUpload(record, signal, (lifecycle) => this.files.completeMultipart(this.getMultipart(record), ownerId, lifecycle));
  }

  private getMultipart(record: UploadRecord): MultipartUpload {
    if (!record.multipart) throw new ConflictException('La operación no corresponde a una carga por partes.');
    return record.multipart;
  }

  private async claimMultipart(ownerId: string, operationId: string, validate: (file: MultipartUpload) => void): Promise<UploadRecord> {
    if (!await this.registry.get(ownerId, operationId)) throw new NotFoundException('No se encontró la operación de carga.');
    return this.registry.update(ownerId, operationId, (current) => {
      const file = this.getMultipart(current);
      if (current.phase !== 'uploading' || current.leaseUntil < Date.now() || file.busy || !file.uploadId) {
        throw new ConflictException('La operación de carga no está disponible.');
      }
      validate(file);
      return { ...current, multipart: { ...file, busy: true }, leaseUntil: Date.now() + uploadLeaseMs };
    });
  }

  private runMultipartStep(record: UploadRecord, signal: AbortSignal | undefined, step: (activeSignal: AbortSignal) => Promise<void>): Promise<void> {
    return this.withUpload(record, signal, async (controller) => {
      try {
        await step(controller.signal);
      } catch (error: unknown) {
        await this.failUpload(record, controller.signal.aborted);
        if (error instanceof BadRequestException || error instanceof ConflictException) throw error;
        throw new ServiceUnavailableException('Falló el almacenamiento de la carga por partes.');
      }
    });
  }

  private async failUpload(record: UploadRecord, aborted: boolean): Promise<void> {
    const cleanup = await this.registry.update(record.ownerId, record.operationId, (state) =>
      ['uploading', 'confirming', 'cancelling'].includes(state.phase) ? {
        ...state, phase: 'cleanupPending', cleanupOutcome: aborted || state.phase === 'cancelling' ? 'cancelled' : 'failed',
      } : state);
    if (cleanup.phase === 'cleanupPending') await this.cleanup(cleanup);
  }

  private async withUpload<T>(record: UploadRecord, signal: AbortSignal | undefined, work: (controller: AbortController, confirm: () => void) => Promise<T>): Promise<T> {
    const { ownerId, operationId } = record;
    const controller = new AbortController();
    const key = this.key(ownerId, operationId);
    this.active.set(key, controller);
    let confirming = false;
    let checking = false;
    const abort = () => { if (!confirming) controller.abort(); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const heartbeat = setInterval(() => {
      if (checking) return;
      checking = true;
      void this.registry.update(ownerId, operationId, (current) => ['uploading', 'confirming'].includes(current.phase)
        ? { ...current, leaseUntil: Date.now() + uploadLeaseMs } : current)
        .then((current) => { if (current.phase === 'cancelling') abort(); })
        .catch(abort).finally(() => { checking = false; });
    }, 2000);
    heartbeat.unref();

    try {
      return await work(controller, () => { confirming = true; });
    } finally {
      clearInterval(heartbeat);
      signal?.removeEventListener('abort', abort);
      if (this.active.get(key) === controller) this.active.delete(key);
    }
  }

  private finishUpload(record: UploadRecord, signal: AbortSignal, write: (lifecycle: UploadLifecycle) => Promise<UploadFileResult>): Promise<UploadFileResult> {
    const { ownerId, operationId } = record;
    return this.withUpload(record, signal, async (controller, confirm) => {
      let confirming = false;
      let result: UploadFileResult;
      try {
        result = await write({
          fileId: record.fileId, signal: controller.signal,
          beforeCommit: async () => {
            controller.signal.throwIfAborted();
            const state = await this.registry.update(ownerId, operationId, (current) => current.phase === 'uploading'
              ? { ...current, phase: 'confirming', leaseUntil: Date.now() + uploadLeaseMs } : current);
            if (state.phase !== 'confirming') throw new Error('Upload cancellation won');
            confirming = true;
            confirm();
          },
        });
      } catch (error: unknown) {
        const current = await this.registry.get(ownerId, operationId);
        const cancelled = !confirming && (controller.signal.aborted || current?.phase === 'cancelling');
        await this.failUpload(record, cancelled);
        if (cancelled) throw new BadRequestException('La carga fue cancelada.');
        throw error;
      }
      // If Redis is temporarily unavailable, the durable confirming record is reconciled later.
      const completed = await this.registry.update(ownerId, operationId, (current) => current.phase === 'confirming'
        ? { ...current, phase: 'completed', asynchronous: result.asynchronous } : current);
      if (completed.phase !== 'completed') {
        await this.files.cleanupUpload(record.fileId);
        throw new ServiceUnavailableException('La operación ya no puede confirmarse.');
      }
      return result;
    });
  }

  async cancel(ownerId: string, operationId: string): Promise<UploadOperationResponse> {
    const record = await this.registry.requestCancellation(ownerId, operationId);
    if (record.phase === 'cancelling') {
      this.active.get(this.key(ownerId, operationId))?.abort();
      if (record.multipart && !record.multipart.busy) await this.failUpload(record, true);
    }
    return this.status(ownerId, operationId);
  }

  async status(ownerId: string, operationId: string): Promise<UploadOperationResponse> {
    let record = await this.registry.get(ownerId, operationId);
    if (!record) throw new NotFoundException('No se encontró la operación de carga.');
    if (record.phase === 'cleanupPending' || (record.leaseUntil < Date.now() && !this.active.has(this.key(ownerId, operationId)))) {
      await this.recover(record);
      record = await this.registry.get(ownerId, operationId) ?? record;
    }
    const file = record.phase === 'completed' ? await this.files.getStatus(record.fileId, ownerId) : null;
    return { phase: record.phase, file, asynchronous: record.asynchronous };
  }

  private async cleanup(record: UploadRecord): Promise<void> {
    try {
      const latest = await this.registry.get(record.ownerId, record.operationId);
      if (latest?.phase !== 'cleanupPending') return;
      if (latest.multipart) await this.files.abortMultipart(record.fileId, latest.multipart.uploadId);
      await this.files.cleanupUpload(record.fileId);
      await this.registry.update(record.ownerId, record.operationId, (current) => current.phase === 'cleanupPending'
        ? { ...current, phase: current.cleanupOutcome } : current);
    } catch {
      this.logger.warn(`Upload cleanup pending: ${record.operationId}`);
    }
  }

  private async recover(record: UploadRecord): Promise<void> {
    if (['cancelled', 'completed', 'failed'].includes(record.phase)) return;
    if (record.phase === 'cleanupPending') { await this.cleanup(record); return; }
    if (record.leaseUntil >= Date.now()) return;
    if (record.phase === 'confirming') {
      try {
        const file = await this.files.getStatus(record.fileId, record.ownerId);
        if (file.status !== 'FAILED') {
          if (file.status === 'PROCESSING') await this.files.requeueProcessing(record.fileId);
          await this.registry.update(record.ownerId, record.operationId, (current) => current.phase === 'confirming' && current.leaseUntil < Date.now()
            ? { ...current, phase: 'completed', asynchronous: file.status === 'PROCESSING' } : current);
          return;
        }
      } catch (error: unknown) {
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    const pending = await this.registry.update(record.ownerId, record.operationId, (current) =>
      ['uploading', 'confirming', 'cancelling'].includes(current.phase) && current.leaseUntil < Date.now()
        ? { ...current, phase: 'cleanupPending', cleanupOutcome: current.phase === 'cancelling' ? 'cancelled' : 'failed' } : current);
    if (pending.phase === 'cleanupPending') await this.cleanup(pending);
  }

  private async recoverPending(): Promise<void> {
    if (this.recovering) return;
    this.recovering = true;
    try {
      for (const record of await this.registry.pending()) {
        if (!this.active.has(this.key(record.ownerId, record.operationId))) await this.recover(record);
      }
    } catch {
      this.logger.warn('Upload recovery is temporarily unavailable.');
    } finally { this.recovering = false; }
  }
}
