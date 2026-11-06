import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { BadRequestException, NotFoundException, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import type { SQSClient } from '@aws-sdk/client-sqs';
import { FilesService } from '../src/files/files.service';
import type { FileStorageClients } from '../src/files/file.types';
import { PrismaService } from '../src/prisma/prisma.service';

interface StoredFileInput {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: bigint;
  s3Key: string;
  ownerId: string;
  folderId?: string | null;
  checksum: string | null;
  status: 'PROCESSING' | 'AVAILABLE' | 'FAILED';
}

interface TestOptions {
  failS3Put?: boolean;
  failDatabaseCreate?: boolean;
  failDatabaseList?: boolean;
  folderOwnerId?: string;
}

function createHarness(options: TestOptions = {}) {
  const commands: unknown[] = [];
  const data: StoredFileInput[] = [];
  const s3 = {
    send: async (command: unknown): Promise<unknown> => {
      commands.push(command);
      if (command instanceof PutObjectCommand) {
        if (options.failS3Put) throw new Error('S3 unavailable');
        const body = command.input.Body;
        assert.ok(body instanceof Readable);
        for await (const _chunk of body) {
          // Consume the upload stream so byte validation and hashing finish.
        }
      }
      return {};
    },
  } as unknown as S3Client;
  const sqs = { send: async (): Promise<unknown> => ({}) } as unknown as SQSClient;
  const prisma = {
    folder: {
      findFirst: async ({ where }: { where: { id: string; ownerId: string } }) =>
        where.id === 'folder-1' && where.ownerId === options.folderOwnerId ? { id: 'folder-1' } : null,
    },
    storedFile: {
      findMany: async ({ where }: { where: { ownerId: string } }) => {
        if (options.failDatabaseList) throw new Error('PostgreSQL unavailable');
        return data.filter((file) => file.ownerId === where.ownerId).map(asPrismaFile);
      },
      create: async ({ data: file }: { data: StoredFileInput }) => {
        if (options.failDatabaseCreate) throw new Error('PostgreSQL unavailable');
        data.push(file);
        return asPrismaFile(file);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = data.findIndex((file) => file.id === where.id);
        if (index >= 0) data.splice(index, 1);
        return {};
      },
    },
  } as unknown as PrismaService;
  const clients: FileStorageClients = { s3, sqs };
  return { service: new FilesService(prisma, clients), commands, data };
}

function asPrismaFile(file: StoredFileInput) {
  return { ...file, createdAt: new Date('2026-10-27T12:00:00.000Z') };
}

test('FilesService validates name, MIME type, non-empty size and configured maximum before storage', async () => {
  const { service, commands } = createHarness();
  const invalidInputs = [
    { name: '  ', contentType: 'text/plain', size: 1 },
    { name: 'file.txt', contentType: 'not-a-mime', size: 1 },
    { name: 'file.txt', contentType: 'text/plain', size: 0 },
  ];

  for (const input of invalidInputs) {
    await assert.rejects(service.upload(Readable.from('x'), input.name, input.contentType, input.size, 'user-1'), BadRequestException);
  }
  await assert.rejects(
    service.upload(Readable.from('x'), 'large.bin', 'application/octet-stream', 100 * 1024 * 1024 + 1, 'user-1'),
    PayloadTooLargeException,
  );
  assert.equal(commands.length, 0);
});

test('FilesService accepts a file at the 100 MiB limit and persists its owner and available status', async () => {
  const { service, data } = createHarness();
  const maxBytes = 100 * 1024 * 1024;
  const source = Readable.from((async function* () {
    const chunk = Buffer.alloc(1024 * 1024);
    for (let sent = 0; sent < maxBytes; sent += chunk.byteLength) yield chunk;
  })());

  const result = await service.upload(source, '  exact-limit.bin  ', 'application/octet-stream', maxBytes, 'user-1');

  assert.equal(result.file.name, 'exact-limit.bin');
  assert.equal(result.file.sizeBytes, maxBytes);
  assert.equal(result.file.status, 'PROCESSING');
  assert.equal(data[0]?.ownerId, 'user-1');
  assert.equal(data[0]?.status, 'PROCESSING');
});

test('FilesService rejects a body whose actual size does not match Content-Length and cleans up S3', async () => {
  const { service, commands, data } = createHarness();

  await assert.rejects(service.upload(Readable.from('short'), 'file.txt', 'text/plain', 10, 'user-1'), BadRequestException);

  assert.ok(commands.some((command) => command instanceof DeleteObjectCommand));
  assert.equal(data.length, 0);
});

test('FilesService rejects a stream larger than the configured maximum even when Content-Length is understated', async () => {
  const previousMaxSize = process.env.FILE_MAX_SIZE_BYTES;
  process.env.FILE_MAX_SIZE_BYTES = '4';
  const { service, commands } = createHarness();

  try {
    await assert.rejects(service.upload(Readable.from('12345'), 'file.txt', 'text/plain', 4, 'user-1'), PayloadTooLargeException);
    assert.ok(commands.some((command) => command instanceof DeleteObjectCommand));
  } finally {
    if (previousMaxSize === undefined) delete process.env.FILE_MAX_SIZE_BYTES;
    else process.env.FILE_MAX_SIZE_BYTES = previousMaxSize;
  }
});

test('FilesService maps S3 errors to a controlled 503 and does not create metadata', async () => {
  const { service, data } = createHarness({ failS3Put: true });

  await assert.rejects(service.upload(Readable.from('content'), 'file.txt', 'text/plain', 7, 'user-1'), ServiceUnavailableException);

  assert.equal(data.length, 0);
});

test('FilesService removes the S3 object when PostgreSQL cannot persist metadata', async () => {
  const { service, commands, data } = createHarness({ failDatabaseCreate: true });

  await assert.rejects(service.upload(Readable.from('content'), 'file.txt', 'text/plain', 7, 'user-1'), ServiceUnavailableException);

  assert.ok(commands.some((command) => command instanceof DeleteObjectCommand));
  assert.equal(data.length, 0);
});

test('FilesService lists only records owned by the requested user', async () => {
  const { service, data } = createHarness();
  const first = await service.upload(Readable.from('one'), 'one.txt', 'text/plain', 3, 'user-1');
  const second = await service.upload(Readable.from('two'), 'two.txt', 'text/plain', 3, 'user-2');

  assert.deepEqual((await service.list('user-1')).map((file) => file.id), [first.file.id]);
  assert.deepEqual((await service.list('user-2')).map((file) => file.id), [second.file.id]);
  assert.equal(data.length, 2);
});

test('FilesService maps PostgreSQL listing failures to a controlled 503', async () => {
  const { service } = createHarness({ failDatabaseList: true });

  await assert.rejects(service.list('user-1'), ServiceUnavailableException);
});

test('FilesService assigns uploads to an owned folder and rejects a foreign destination before S3', async () => {
  const owned = createHarness({ folderOwnerId: 'user-1' });
  await owned.service.upload(Readable.from('inside'), 'inside.txt', 'text/plain', 6, 'user-1', { folderId: 'folder-1' });
  assert.equal(owned.data[0]?.folderId, 'folder-1');

  const foreign = createHarness({ folderOwnerId: 'user-2' });
  await assert.rejects(
    foreign.service.upload(Readable.from('secret'), 'secret.txt', 'text/plain', 6, 'user-1', { folderId: 'folder-1' }),
    NotFoundException,
  );
  assert.equal(foreign.commands.some((command) => command instanceof PutObjectCommand), false);
});

test('FilesService downloads only available files owned by the requester and maps S3 failures', async () => {
  const file: StoredFileInput = {
    id: 'a8120cf2-69df-4f51-a80a-ec44fe2120a1', name: 'report.txt', contentType: 'text/plain',
    sizeBytes: 6n, s3Key: 'files/file-1', ownerId: 'owner-1', checksum: 'abc', status: 'AVAILABLE',
  };
  let stored = file;
  let failGet = false;
  const s3 = { send: async (command: unknown): Promise<unknown> => {
    assert.ok(command instanceof GetObjectCommand);
    if (failGet) throw new Error('S3 unavailable');
    return { Body: Readable.from('report') };
  } } as unknown as S3Client;
  const prisma = { storedFile: { findFirst: async ({ where }: { where: { id: string; ownerId: string; deletedAt: null } }) =>
    where.id === stored.id && where.ownerId === stored.ownerId ? asPrismaFile(stored) : null } } as unknown as PrismaService;
  const service = new FilesService(prisma, { s3, sqs: { send: async () => ({}) } as unknown as SQSClient });

  const download = await service.getDownload(file.id, 'owner-1');
  assert.equal(download.file.name, 'report.txt');
  assert.equal(download.file.contentType, 'text/plain');
  assert.equal(await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    download.body.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
    download.body.on('end', () => resolve(Buffer.concat(chunks).toString()));
    download.body.on('error', reject);
  }), 'report');
  await assert.rejects(service.getDownload(file.id, 'another-user'), /archivo solicitado/u);
  await assert.rejects(service.getDownload('00000000-0000-4000-8000-000000000000', 'owner-1'), NotFoundException);
  stored = { ...file, status: 'PROCESSING' };
  await assert.rejects(service.getDownload(file.id, 'owner-1'), ServiceUnavailableException);
  stored = { ...file, status: 'FAILED' };
  await assert.rejects(service.getDownload(file.id, 'owner-1'), ServiceUnavailableException);
  stored = file;
  failGet = true;
  await assert.rejects(service.getDownload(file.id, 'owner-1'), ServiceUnavailableException);
});
