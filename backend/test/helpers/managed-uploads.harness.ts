import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand, UploadPartCommand, type S3Client } from '@aws-sdk/client-s3';
import type { SQSClient } from '@aws-sdk/client-sqs';
import type { PrismaService } from '../../src/prisma/prisma.service';
import type { RedisService } from '../../src/redis/redis.service';
import { FilesService } from '../../src/files/files.service';
import { ManagedUploadsService } from '../../src/files/managed-uploads.service';
import { UploadRegistryService } from '../../src/files/upload-registry.service';

export interface TestStoredFile {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  contentType: string;
  sizeBytes: bigint;
  s3Key: string;
  checksum: string | null;
  status: 'PROCESSING' | 'AVAILABLE' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ManagedHarnessOptions {
  failDelete: boolean;
  failCreate: boolean;
  beforePutReturn?: () => Promise<void>;
  beforeCreate?: () => Promise<void>;
}

export function createManagedHarness() {
  const values = new Map<string, string>();
  const indexed = new Set<string>();
  const ttls = new Map<string, number>();
  const redis = {
    get: async (key: string) => values.get(key) ?? null,
    createIndexedRecord: async (key: string, _index: string, value: string, ttl: number) => {
      if (values.has(key)) return false;
      values.set(key, value);
      if (!ttl) indexed.add(key);
      ttls.set(key, ttl);
      return true;
    },
    replaceIndexedRecord: async (key: string, _index: string, expected: string, value: string, ttl: number) => {
      if (values.get(key) !== expected) return false;
      values.set(key, value);
      if (ttl) indexed.delete(key); else indexed.add(key);
      ttls.set(key, ttl);
      return true;
    },
    indexedRecords: async () => [...indexed],
  } as unknown as RedisService;
  const records: TestStoredFile[] = [];
  const objects = new Set<string>();
  const multipartUploads = new Map<string, Map<number, Buffer>>();
  const multipartObjects = new Map<string, Buffer>();
  const processingMessages: string[] = [];
  const storageSignals: Array<AbortSignal | undefined> = [];
  const options: ManagedHarnessOptions = { failDelete: false, failCreate: false };
  const prisma = {
    storedFile: {
      create: async ({ data }: { data: Omit<TestStoredFile, 'createdAt'> }) => {
        await options.beforeCreate?.();
        if (options.failCreate) throw new Error('Database unavailable');
        const createdAt = new Date();
        const record = { ...data, description: null, folderId: null, deletionPending: false, createdAt, updatedAt: createdAt, deletedAt: null };
        records.push(record);
        return record;
      },
      findFirst: async ({ where }: { where: { id: string; ownerId: string } }) => records.find((file) => file.id === where.id && file.ownerId === where.ownerId) ?? null,
      updateMany: async ({ where, data }: { where: { id: string }; data: { status: TestStoredFile['status'] } }) => {
        records.filter((file) => file.id === where.id).forEach((file) => { file.status = data.status; });
        return { count: records.filter((file) => file.id === where.id).length };
      },
      deleteMany: async ({ where }: { where: { id: string } }) => {
        const index = records.findIndex((file) => file.id === where.id);
        if (index >= 0) records.splice(index, 1);
        return { count: index >= 0 ? 1 : 0 };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = records.findIndex((file) => file.id === where.id);
        if (index >= 0) records.splice(index, 1);
        return {};
      },
    },
  } as unknown as PrismaService;
  prisma.$transaction = (async (callback: (tx: PrismaService) => Promise<unknown>) => callback(prisma)) as unknown as typeof prisma.$transaction;
  const s3 = { send: async (command: unknown, requestOptions?: { abortSignal?: AbortSignal }) => {
    if (command instanceof PutObjectCommand) {
      storageSignals.push(requestOptions?.abortSignal);
      const body = command.input.Body;
      assert.ok(body instanceof Readable);
      for await (const _chunk of body) { /* Consume and validate the actual request body. */ }
      objects.add(String(command.input.Key));
      await options.beforePutReturn?.();
    } else if (command instanceof CreateMultipartUploadCommand) {
      const uploadId = String(command.input.Key);
      multipartUploads.set(uploadId, new Map());
      return { UploadId: uploadId };
    } else if (command instanceof UploadPartCommand) {
      const parts = multipartUploads.get(String(command.input.UploadId));
      assert.ok(parts && command.input.PartNumber && Buffer.isBuffer(command.input.Body));
      assert.equal(command.input.ContentLength, command.input.Body.length);
      parts.set(command.input.PartNumber, command.input.Body);
      return { ETag: `"part-${command.input.PartNumber}"` };
    } else if (command instanceof CompleteMultipartUploadCommand) {
      const id = String(command.input.UploadId);
      const stored = multipartUploads.get(id);
      assert.ok(stored);
      const buffers = command.input.MultipartUpload?.Parts?.map(({ ETag, PartNumber }) => {
        assert.equal(ETag, `"part-${PartNumber}"`);
        const part = stored.get(Number(PartNumber));
        assert.ok(part);
        return part;
      });
      assert.ok(buffers);
      multipartObjects.set(String(command.input.Key), Buffer.concat(buffers));
      objects.add(String(command.input.Key));
      multipartUploads.delete(id);
    } else if (command instanceof GetObjectCommand) {
      const bytes = multipartObjects.get(String(command.input.Key));
      assert.ok(bytes);
      return { Body: Readable.from([bytes]) };
    } else if (command instanceof AbortMultipartUploadCommand) {
      multipartUploads.delete(String(command.input.UploadId));
    } else if (command instanceof DeleteObjectCommand) {
      if (options.failDelete) throw new Error('S3 cleanup unavailable');
      objects.delete(String(command.input.Key));
      multipartObjects.delete(String(command.input.Key));
    }
    return {};
  } } as unknown as S3Client;
  const sqs = { send: async (command: { input: { MessageBody?: string } }) => {
    if (command.input.MessageBody) processingMessages.push(command.input.MessageBody);
    return {};
  } } as unknown as SQSClient;
  const files = new FilesService(prisma, { s3, sqs });
  const registry = new UploadRegistryService(redis);
  const managed = new ManagedUploadsService(files, registry);
  return { managed, registry, files, records, objects, values, indexed, ttls, options, storageSignals, multipartUploads, multipartObjects, processingMessages };
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}
