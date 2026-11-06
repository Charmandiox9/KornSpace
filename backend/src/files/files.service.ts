import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Optional,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { Transform, type Readable } from 'node:stream';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { PrismaService } from '../prisma/prisma.service';
import { folderAccess } from '../folders/folder-policy';
import { fileAccess, nameConflict, validateFileName } from './file-policy';
import { FILE_STORAGE_CLIENTS, type FileStorageClients, type ProcessFileMessage, type StoredFileResponse, type UploadFileResult, type UploadLifecycle } from './file.types';

const defaultAsyncThresholdBytes = 10 * 1024 * 1024;
const defaultMaxFileSizeBytes = 100 * 1024 * 1024;

interface FileStorageConfiguration {
  endpoint: string;
  bucket: string;
  queueUrl: string;
  region: string;
  asyncThresholdBytes: number;
  maxFileSizeBytes: number;
}

interface FileStreamMetadata {
  stream: Transform;
  checksum: () => string;
  receivedBytes: () => number;
}

class InvalidFileBodyError extends Error {}
class OversizedFileBodyError extends Error {}

@Injectable()
export class FilesService {
  private readonly configuration: FileStorageConfiguration;
  private readonly s3: S3Client;
  private readonly sqs: SQSClient;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(FILE_STORAGE_CLIENTS) clients?: FileStorageClients,
  ) {
    this.configuration = {
      endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:4566',
      bucket: process.env.S3_BUCKET ?? 'kornspace-files',
      queueUrl: process.env.SQS_QUEUE_URL ?? 'http://localhost:4566/000000000000/kornspace-file-processing',
      region: process.env.AWS_REGION ?? 'us-east-1',
      asyncThresholdBytes: this.readPositiveInteger('FILE_ASYNC_THRESHOLD_BYTES', defaultAsyncThresholdBytes),
      maxFileSizeBytes: this.readPositiveInteger('FILE_MAX_SIZE_BYTES', defaultMaxFileSizeBytes),
    };
    const clientConfiguration = {
      endpoint: this.configuration.endpoint,
      region: this.configuration.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
      },
    };
    this.s3 = clients?.s3 ?? new S3Client(clientConfiguration);
    this.sqs = clients?.sqs ?? new SQSClient({
      ...clientConfiguration,
      endpoint: process.env.SQS_ENDPOINT ?? this.configuration.endpoint,
    });
  }

  async list(ownerId: string): Promise<StoredFileResponse[]> {
    try {
      const files = await this.prisma.storedFile.findMany({ where: { ownerId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
      return files.map((file) => this.toResponse(file));
    } catch {
      throw new ServiceUnavailableException('No fue posible consultar los archivos.');
    }
  }

  async listTrash(ownerId: string): Promise<StoredFileResponse[]> {
    const files = await this.prisma.storedFile.findMany({ where: { ownerId, deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } });
    return files.map((file) => this.toResponse(file));
  }

  async moveToTrash(id: string, ownerId: string): Promise<void> {
    const { file } = await fileAccess(this.prisma, id, ownerId, true);
    const result = await this.prisma.storedFile.updateMany({ where: { id, ownerId: file.ownerId, deletedAt: null, deletionPending: false }, data: { deletedAt: new Date() } });
    if (!result.count) throw new NotFoundException('No se encontró el archivo.');
  }

  async restoreFromTrash(id: string, ownerId: string, replaceFileId?: string): Promise<void> {
    const file = await this.prisma.storedFile.findFirst({ where: { id, ownerId, deletionPending: false, deletedAt: { not: null, gt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) } } });
    if (!file) throw new NotFoundException('No se encontró el archivo en la papelera.');
    let restored;
    try {
      restored = await this.prisma.$transaction(async (tx) => {
        const conflict = await tx.storedFile.findFirst({ where: { ownerId, folderId: file.folderId, name: file.name, deletedAt: null } });
        if (conflict && conflict.id !== replaceFileId) nameConflict(conflict);
        if (conflict) await tx.storedFile.update({ where: { id: conflict.id }, data: { deletedAt: new Date() } });
        const result = await tx.storedFile.updateMany({ where: { id, ownerId, deletedAt: file.deletedAt, deletionPending: false }, data: { deletedAt: null } });
        if (!result.count) throw new NotFoundException('El archivo ya no está disponible en la papelera.');
        return result;
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        const current = await this.prisma.storedFile.findFirst({ where: { ownerId, folderId: file.folderId, name: file.name, deletedAt: null } });
        nameConflict(current);
      }
      throw error;
    }
    if (!restored.count) throw new NotFoundException('El archivo ya no está en la papelera.');
    if (file.status === 'PROCESSING') await this.requeueProcessing(id);
  }

  async permanentlyDelete(id: string, ownerId: string): Promise<void> {
    const file = await this.prisma.storedFile.findFirst({ where: { id, ownerId, deletedAt: { not: null } } });
    if (!file) throw new NotFoundException('No se encontró el archivo en la papelera.');
    try {
      const claimed = await this.prisma.storedFile.updateMany({ where: { id, ownerId, deletedAt: file.deletedAt }, data: { deletionPending: true } });
      if (!claimed.count) throw new NotFoundException('El archivo ya no está en la papelera.');
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.configuration.bucket, Key: file.s3Key }));
      await this.prisma.storedFile.deleteMany({ where: { id, ownerId, deletionPending: true } });
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException('La eliminación está pendiente. Puedes reintentar.');
    }
  }

  async emptyTrash(ownerId: string): Promise<{ deleted: number; pending: number }> {
    const files = await this.prisma.storedFile.findMany({ where: { ownerId, deletedAt: { not: null } } });
    let deleted = 0;
    for (const file of files) {
      try { await this.permanentlyDelete(file.id, ownerId); deleted += 1; } catch { /* Keep pending metadata for retry. */ }
    }
    return { deleted, pending: files.length - deleted };
  }

  async purgeExpiredTrash(): Promise<void> {
    const expired = await this.prisma.storedFile.findMany({ where: { deletedAt: { not: null }, OR: [{ deletedAt: { lte: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) } }, { deletionPending: true }] }, take: 50 });
    for (const file of expired) {
      try {
        if (file.ownerId) await this.permanentlyDelete(file.id, file.ownerId);
      } catch { /* Keep metadata in trash so the next sweep retries cleanup. */ }
    }
  }

  async upload(
    source: Readable,
    name: string,
    contentType: string,
    sizeBytes: number,
    ownerId: string,
    lifecycle: UploadLifecycle = {},
  ): Promise<UploadFileResult> {
    const normalizedName = this.validateUpload(name, contentType, sizeBytes);
    if (lifecycle.folderId) ownerId = (await folderAccess(this.prisma, lifecycle.folderId, ownerId, true)).folder.ownerId;
    const collision = await this.prisma.storedFile.findFirst({ where: { ownerId, folderId: lifecycle.folderId ?? null, name: normalizedName, deletedAt: null } });
    if (collision && collision.id !== lifecycle.replaceFileId) nameConflict(collision);
    lifecycle.signal?.throwIfAborted();
    const id = lifecycle.fileId ?? randomUUID();
    const s3Key = `files/${id}`;
    const streamMetadata = this.createHashingStream(source, sizeBytes);
    const storageController = new AbortController();
    const abort = () => {
      source.unpipe(streamMetadata.stream);
      if (streamMetadata.receivedBytes() === sizeBytes) {
        // Once all bytes reached the storage stream, wait for PUT acknowledgement
        // before compensating. Aborting that response could race a later S3 commit.
        if (!streamMetadata.stream.writableEnded) streamMetadata.stream.end();
      } else {
        // The request is already being aborted; destroying with an error can emit
        // an unhandled stream error after the storage consumer has detached.
        streamMetadata.stream.destroy();
        storageController.abort();
      }
    };
    lifecycle.signal?.addEventListener('abort', abort, { once: true });

    try {
      await this.s3.send(new PutObjectCommand({
        Bucket: this.configuration.bucket,
        Key: s3Key,
        Body: streamMetadata.stream,
        ContentLength: sizeBytes,
        ContentType: contentType.trim(),
      }), { abortSignal: storageController.signal });
      lifecycle.signal?.throwIfAborted();
      await lifecycle.beforeCommit?.();
    } catch (error: unknown) {
      await this.deleteObjectQuietly(s3Key);
      if (error instanceof InvalidFileBodyError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof OversizedFileBodyError) {
        throw new PayloadTooLargeException(`El tamaño máximo permitido es ${this.configuration.maxFileSizeBytes} bytes.`);
      }
      throw new ServiceUnavailableException('No fue posible guardar el archivo en el almacenamiento.');
    } finally {
      lifecycle.signal?.removeEventListener('abort', abort);
    }

    const asynchronous = sizeBytes > this.configuration.asyncThresholdBytes;
    let replacedId: string | undefined;
    const replacedAt = new Date();
    let file: Awaited<ReturnType<PrismaService['storedFile']['create']>>;
    try {
      const create = (tx: Pick<PrismaService, 'storedFile'>) => tx.storedFile.create({
        data: {
          id,
          name: normalizedName,
          contentType: contentType.trim(),
          sizeBytes: BigInt(sizeBytes),
          s3Key,
          ownerId,
          folderId: lifecycle.folderId ?? null,
          checksum: asynchronous ? null : streamMetadata.checksum(),
          status: asynchronous ? 'PROCESSING' : 'AVAILABLE',
        },
      });
      file = await this.prisma.$transaction(async (tx) => {
        const target = await tx.storedFile.findFirst({ where: { ownerId, folderId: lifecycle.folderId ?? null, name: normalizedName, deletedAt: null } });
        if (target && target.id !== lifecycle.replaceFileId) nameConflict(target);
        if (target) {
          await tx.storedFile.update({ where: { id: target.id }, data: { deletedAt: replacedAt } });
          replacedId = target.id;
        }
        const created = await create(tx);
        if (target) {
          const grants = await tx.filePermission.findMany({ where: { fileId: target.id } });
          if (grants.length) await tx.filePermission.createMany({ data: grants.map((grant) => ({ fileId: created.id, userId: grant.userId, role: grant.role })) });
        }
        return created;
      });
    } catch (error: unknown) {
      await this.deleteObjectQuietly(s3Key);
      if (error instanceof ConflictException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        const current = await this.prisma.storedFile.findFirst({ where: { ownerId, folderId: lifecycle.folderId ?? null, name: normalizedName, deletedAt: null } });
        nameConflict(current);
      }
      throw new ServiceUnavailableException('El archivo llegó al almacenamiento, pero no fue posible guardar sus metadatos.');
    }

    if (asynchronous) {
      const message: ProcessFileMessage = { fileId: id, s3Key };
      try {
        await this.sqs.send(new SendMessageCommand({
          QueueUrl: this.configuration.queueUrl,
          MessageBody: JSON.stringify(message),
        }));
      } catch {
        await this.prisma.storedFile.delete({ where: { id } }).catch(() => undefined);
        await this.deleteObjectQuietly(s3Key);
        if (replacedId) await this.prisma.storedFile.updateMany({ where: { id: replacedId, deletedAt: replacedAt, deletionPending: false }, data: { deletedAt: null } }).catch(() => undefined);
        throw new ServiceUnavailableException('No fue posible programar el procesamiento del archivo.');
      }
    }

    return { file: this.toResponse(file), asynchronous };
  }

  async cleanupUpload(fileId: string): Promise<void> {
    // Disable downloads before deleting an object; retain FAILED metadata if cleanup must retry.
    await this.prisma.storedFile.updateMany({ where: { id: fileId }, data: { status: 'FAILED' } });
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.configuration.bucket, Key: `files/${fileId}` }));
    await this.prisma.storedFile.deleteMany({ where: { id: fileId } });
  }

  async requeueProcessing(fileId: string): Promise<void> {
    const message: ProcessFileMessage = { fileId, s3Key: `files/${fileId}` };
    await this.sqs.send(new SendMessageCommand({ QueueUrl: this.configuration.queueUrl, MessageBody: JSON.stringify(message) }));
  }

  async getDownload(id: string, ownerId: string): Promise<{ file: StoredFileResponse; body: Readable }> {
    const { file } = await fileAccess(this.prisma, id, ownerId);
    if (file.deletedAt || file.deletionPending) {
      throw new NotFoundException('No se encontró el archivo solicitado.');
    }
    if (file.status !== 'AVAILABLE') {
      throw new ServiceUnavailableException('El archivo todavía no está disponible.');
    }

    let body: Readable | undefined;
    try {
      const result = await this.s3.send(new GetObjectCommand({
        Bucket: this.configuration.bucket,
        Key: file.s3Key,
      }));
      if (result.Body && 'pipe' in result.Body) body = result.Body as Readable;
    } catch {
      throw new ServiceUnavailableException('No fue posible recuperar el archivo del almacenamiento.');
    }
    if (!body) {
      throw new ServiceUnavailableException('El almacenamiento no devolvió el contenido del archivo.');
    }
    return { file: this.toResponse(file), body };
  }

  async getStatus(id: string, ownerId: string): Promise<StoredFileResponse> {
    const file = await this.prisma.storedFile.findFirst({ where: { id, ownerId } });
    if (!file) {
      throw new NotFoundException('No se encontró el archivo solicitado.');
    }
    return this.toResponse(file);
  }

  private validateUpload(name: string, contentType: string, sizeBytes: number): string {
    const normalizedName = validateFileName(name);
    if (!normalizedName || normalizedName.length > 255 || /[\u0000-\u001f]/u.test(normalizedName)) {
      throw new BadRequestException('El nombre del archivo no es válido.');
    }
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
      throw new BadRequestException('El archivo debe contener al menos un byte y declarar un tamaño válido.');
    }
    if (sizeBytes > this.configuration.maxFileSizeBytes) {
      throw new PayloadTooLargeException(`El tamaño máximo permitido es ${this.configuration.maxFileSizeBytes} bytes.`);
    }
    const normalizedContentType = contentType.trim();
    const mimeTypePattern = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+(?:\s*;\s*[!#$%&'*+.^_`|~0-9A-Za-z-]+=(?:[!#$%&'*+.^_`|~0-9A-Za-z-]+|"[^"\r\n]*"))*$/u;
    if (!normalizedContentType || normalizedContentType.length > 255 || !mimeTypePattern.test(normalizedContentType)) {
      throw new BadRequestException('El tipo de contenido no es válido.');
    }
    return normalizedName;
  }

  private createHashingStream(source: Readable, expectedSizeBytes: number): FileStreamMetadata {
    const hash = createHash('sha256');
    let sizeBytes = 0;
    const maxFileSizeBytes = this.configuration.maxFileSizeBytes;
    const stream = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        sizeBytes += chunk.byteLength;
        if (sizeBytes > maxFileSizeBytes) {
          callback(new OversizedFileBodyError());
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
      flush: (callback) => {
        if (sizeBytes === 0) {
          callback(new InvalidFileBodyError('No se permiten archivos vacíos.'));
          return;
        }
        if (sizeBytes !== expectedSizeBytes) {
          callback(new InvalidFileBodyError('El tamaño recibido no coincide con Content-Length.'));
          return;
        }
        callback();
      },
    });
    source.once('error', (error: Error) => stream.destroy(error));
    // A transport abort may precede the SDK attaching its stream consumer.
    stream.on('error', () => undefined);
    source.pipe(stream);
    return { stream, checksum: () => hash.digest('hex'), receivedBytes: () => sizeBytes };
  }

  private async deleteObjectQuietly(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.configuration.bucket, Key: key })).catch(() => undefined);
  }

  private toResponse(file: {
    id: string;
    name: string;
    contentType: string;
    sizeBytes: bigint;
    status: 'PROCESSING' | 'AVAILABLE' | 'FAILED';
    checksum: string | null;
    createdAt: Date;
    deletedAt: Date | null;
  }): StoredFileResponse {
    return {
      id: file.id,
      name: file.name,
      contentType: file.contentType,
      sizeBytes: Number(file.sizeBytes),
      status: file.status,
      checksum: file.checksum,
      createdAt: file.createdAt.toISOString(),
      deletedAt: file.deletedAt?.toISOString() ?? null,
    };
  }

  private readPositiveInteger(name: string, fallback: number): number {
    const parsed = Number(process.env[name]);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
