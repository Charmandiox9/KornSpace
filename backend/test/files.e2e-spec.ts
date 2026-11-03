import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import type { SQSClient } from '@aws-sdk/client-sqs';
import { FilesController } from '../src/files/files.controller';
import { FilesService } from '../src/files/files.service';
import type { FileStorageClients, StoredFileResponse, UploadFileResult } from '../src/files/file.types';
import type { PrismaService } from '../src/prisma/prisma.service';
import { SessionJwtGuard } from '../src/auth/session-jwt.guard';

test('file REST endpoints expose upload, listing, and processing status', async () => {
  const file: StoredFileResponse = {
    id: 'a8120cf2-69df-4f51-a80a-ec44fe2120a1',
    name: 'large.txt',
    contentType: 'text/plain',
    sizeBytes: 11 * 1024 * 1024,
    status: 'PROCESSING',
    checksum: null,
    createdAt: '2026-10-27T12:00:00.000Z',
    deletedAt: null,
  };
  const availableFile: StoredFileResponse = {
    ...file,
    sizeBytes: 4,
    status: 'AVAILABLE',
    checksum: 'abc123',
  };
  let receivedName = '';
  let receivedOwnerId = '';
  const filesServiceStub: Pick<FilesService, 'list' | 'upload' | 'getStatus' | 'getDownload'> = {
    list: async (ownerId) => { receivedOwnerId = ownerId; return [file]; },
    upload: async (_source, name, _contentType, _sizeBytes, ownerId): Promise<UploadFileResult> => {
      receivedName = name;
      receivedOwnerId = ownerId;
      return { file, asynchronous: true };
    },
    getStatus: async () => file,
    getDownload: async () => ({ file: availableFile, body: Readable.from('file') }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [FilesController],
    providers: [{ provide: FilesService, useValue: filesServiceStub }],
  }).overrideGuard(SessionJwtGuard).useValue({
    canActivate: (context: { switchToHttp: () => { getRequest: () => { headers: Record<string, string | undefined>; authContext?: { userId: string } } } }) => {
      const request = context.switchToHttp().getRequest();
      const userId = request.headers['x-test-user'];
      if (!userId) throw new UnauthorizedException();
      request.authContext = { userId };
      return true;
    },
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');

  try {
    const serverAddress = app.getHttpServer().address();
    assert.ok(serverAddress && typeof serverAddress !== 'string');
    const address: AddressInfo = serverAddress;
    const baseUrl = `http://127.0.0.1:${address.port}/api/files`;
    const unauthorizedResponse = await fetch(baseUrl);
    assert.equal(unauthorizedResponse.status, 401);

    const uploadResponse = await fetch(`${baseUrl}?name=large.txt`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', 'x-test-user': 'user-1' },
      body: 'large file contents',
    });
    const uploadPayload: unknown = await uploadResponse.json();
    assert.equal(uploadResponse.status, 202);
    assert.equal(receivedName, 'large.txt');
    assert.equal(receivedOwnerId, 'user-1');
    assert.deepEqual(uploadPayload, { file, asynchronous: true });

    const emptyUploadResponse = await fetch(`${baseUrl}?name=empty.txt`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', 'x-test-user': 'user-1' },
      body: '',
    });
    assert.equal(emptyUploadResponse.status, 400);

    const missingTypeResponse = await fetch(`${baseUrl}?name=file.bin`, {
      method: 'POST',
      headers: { 'x-test-user': 'user-1' },
      body: new Uint8Array([1, 2, 3, 4]),
    });
    assert.equal(missingTypeResponse.status, 400);

    const listResponse = await fetch(baseUrl, { headers: { 'x-test-user': 'user-1' } });
    assert.equal(listResponse.status, 200);
    assert.equal(receivedOwnerId, 'user-1');
    assert.deepEqual(await listResponse.json(), [file]);

    const statusResponse = await fetch(`${baseUrl}/${file.id}/status`, { headers: { 'x-test-user': 'user-1' } });
    assert.equal(statusResponse.status, 200);
    assert.deepEqual(await statusResponse.json(), file);

    const downloadResponse = await fetch(`${baseUrl}/${file.id}`, { headers: { 'x-test-user': 'user-1' } });
    assert.equal(downloadResponse.status, 200);
    assert.equal(downloadResponse.headers.get('content-type'), 'text/plain');
    assert.equal(await downloadResponse.text(), 'file');
  } finally {
    await app.close();
  }
});

test('file HTTP upload enforces size, owner isolation, and controlled S3/DB failures', async () => {
  const priorMaxSize = process.env.FILE_MAX_SIZE_BYTES;
  process.env.FILE_MAX_SIZE_BYTES = '4';
  let failS3Put = false;
  let failDatabaseCreate = false;
  const storedFiles: Array<{
    id: string;
    name: string;
    contentType: string;
    sizeBytes: bigint;
    s3Key: string;
    ownerId: string;
    checksum: string | null;
    status: 'PROCESSING' | 'AVAILABLE';
    createdAt: Date;
  }> = [];
  const s3 = {
    send: async (command: unknown): Promise<unknown> => {
      if (command instanceof PutObjectCommand) {
        if (failS3Put) throw new Error('S3 unavailable');
        const body = command.input.Body;
        assert.ok(body instanceof Readable);
        for await (const _chunk of body) {
          // Consume the request stream just as the S3 client does.
        }
      }
      return {};
    },
  } as unknown as S3Client;
  const sqs = { send: async (): Promise<unknown> => ({}) } as unknown as SQSClient;
  const prisma = {
    storedFile: {
      findMany: async ({ where }: { where: { ownerId: string } }) => storedFiles.filter((file) => file.ownerId === where.ownerId),
      create: async ({ data }: { data: Omit<(typeof storedFiles)[number], 'createdAt'> }) => {
        if (failDatabaseCreate) throw new Error('PostgreSQL unavailable');
        const file = { ...data, createdAt: new Date('2026-10-27T12:00:00.000Z') };
        storedFiles.push(file);
        return file;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = storedFiles.findIndex((file) => file.id === where.id);
        if (index >= 0) storedFiles.splice(index, 1);
        return {};
      },
    },
  } as unknown as PrismaService;
  const clients: FileStorageClients = { s3, sqs };
  const filesService = new FilesService(prisma, clients);
  const moduleRef = await Test.createTestingModule({
    controllers: [FilesController],
    providers: [{ provide: FilesService, useValue: filesService }],
  }).overrideGuard(SessionJwtGuard).useValue({
    canActivate: (context: { switchToHttp: () => { getRequest: () => { headers: Record<string, string | undefined>; authContext?: { userId: string } } } }) => {
      const request = context.switchToHttp().getRequest();
      const userId = request.headers['x-test-user'];
      if (!userId) throw new UnauthorizedException();
      request.authContext = { userId };
      return true;
    },
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');

  try {
    const serverAddress = app.getHttpServer().address();
    assert.ok(serverAddress && typeof serverAddress !== 'string');
    const address: AddressInfo = serverAddress;
    const baseUrl = `http://127.0.0.1:${address.port}/api/files`;
    const headers = { 'content-type': 'text/plain', 'x-test-user': 'user-1' };

    const exactLimitResponse = await fetch(`${baseUrl}?name=valid.txt`, { method: 'POST', headers, body: 'data' });
    assert.equal(exactLimitResponse.status, 201);
    await exactLimitResponse.json();
    assert.equal(storedFiles[0]?.ownerId, 'user-1');

    const missingNameResponse = await fetch(baseUrl, { method: 'POST', headers, body: 'data' });
    assert.equal(missingNameResponse.status, 400);
    const invalidMimeResponse = await fetch(`${baseUrl}?name=invalid.txt`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'not-a-mime' },
      body: 'data',
    });
    assert.equal(invalidMimeResponse.status, 400);
    const emptyFileResponse = await fetch(`${baseUrl}?name=empty.txt`, { method: 'POST', headers, body: '' });
    assert.equal(emptyFileResponse.status, 400);

    const overLimitResponse = await fetch(`${baseUrl}?name=large.txt`, { method: 'POST', headers, body: '12345' });
    assert.equal(overLimitResponse.status, 413);

    const otherUserUploadResponse = await fetch(`${baseUrl}?name=other.txt`, {
      method: 'POST',
      headers: { ...headers, 'x-test-user': 'user-2' },
      body: 'two',
    });
    assert.equal(otherUserUploadResponse.status, 201);
    const ownFilesResponse = await fetch(baseUrl, { headers: { 'x-test-user': 'user-1' } });
    const ownFiles = await ownFilesResponse.json() as StoredFileResponse[];
    assert.deepEqual(ownFiles.map((file) => file.name), ['valid.txt']);

    failS3Put = true;
    const s3FailureResponse = await fetch(`${baseUrl}?name=s3.txt`, { method: 'POST', headers, body: 'bad' });
    assert.equal(s3FailureResponse.status, 503);
    failS3Put = false;

    failDatabaseCreate = true;
    const databaseFailureResponse = await fetch(`${baseUrl}?name=db.txt`, { method: 'POST', headers, body: 'bad' });
    assert.equal(databaseFailureResponse.status, 503);
  } finally {
    await app.close();
    if (priorMaxSize === undefined) delete process.env.FILE_MAX_SIZE_BYTES;
    else process.env.FILE_MAX_SIZE_BYTES = priorMaxSize;
  }
});
