import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { FilesService } from './files.service';
import { UploadRegistryService, uploadLeaseMs, type UploadRecord } from './upload-registry.service';
import type { UploadFileResult, UploadOperationResponse } from './file.types';

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
    const controller = new AbortController();
    const key = this.key(ownerId, operationId);
    this.active.set(key, controller);
    let confirming = false;
    let checking = false;
    const abort = () => { if (!confirming) controller.abort(); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
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
      let result: UploadFileResult;
      try {
        result = await this.files.upload(source, name, contentType, sizeBytes, ownerId, {
          fileId: record.fileId, signal: controller.signal, folderId, replaceFileId,
          beforeCommit: async () => {
            controller.signal.throwIfAborted();
            const state = await this.registry.update(ownerId, operationId, (current) => current.phase === 'uploading'
              ? { ...current, phase: 'confirming', leaseUntil: Date.now() + uploadLeaseMs } : current);
            if (state.phase !== 'confirming') throw new Error('Upload cancellation won');
            confirming = true;
          },
        });
      } catch (error: unknown) {
        const current = await this.registry.get(ownerId, operationId);
        const cancelled = !confirming && (controller.signal.aborted || current?.phase === 'cancelling');
        const cleanup = await this.registry.update(ownerId, operationId, (state) => ({
          ...state, phase: 'cleanupPending', cleanupOutcome: cancelled ? 'cancelled' : 'failed',
        }));
        await this.cleanup(cleanup);
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
    } finally {
      clearInterval(heartbeat);
      signal.removeEventListener('abort', abort);
      this.active.delete(key);
    }
  }

  async cancel(ownerId: string, operationId: string): Promise<UploadOperationResponse> {
    const record = await this.registry.requestCancellation(ownerId, operationId);
    if (record.phase === 'cancelling') this.active.get(this.key(ownerId, operationId))?.abort();
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
