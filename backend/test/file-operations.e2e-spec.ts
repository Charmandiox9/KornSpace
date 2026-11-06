import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { ForbiddenException, NotFoundException, ServiceUnavailableException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import type { SQSClient } from '@aws-sdk/client-sqs';
import type { StoredFile } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { FileLibraryService } from '../src/files/file-library.service';
import { FileLibraryController } from '../src/files/file-library.controller';
import { FilesController } from '../src/files/files.controller';
import { FilesService } from '../src/files/files.service';
import { SessionJwtGuard } from '../src/auth/session-jwt.guard';

interface TestWhere {
  id?: string | { not: string };
  ownerId?: string;
  name?: string;
  folderId?: string | null;
  deletedAt?: Date | null | { not?: null; gt?: Date };
  deletionPending?: boolean;
  permissions?: { some: { userId: string } };
}

function harness() {
  const now = new Date();
  const file: StoredFile = { id: '11111111-1111-4111-8111-111111111111', ownerId: 'owner', folderId: null, name: 'one.txt', contentType: 'text/plain', sizeBytes: 4n, s3Key: 'files/one', checksum: 'hash', status: 'AVAILABLE', createdAt: now, updatedAt: now, deletedAt: null, deletionPending: false };
  const records = [file];
  let failS3 = false;
  let failDatabaseDelete = false;
  let deletes = 0;
  let visits = 0;
  function matches(record: StoredFile, where: TestWhere) {
    if (typeof where.id === 'string' && record.id !== where.id) return false;
    if (typeof where.id === 'object' && record.id === where.id.not) return false;
    if (where.ownerId && record.ownerId !== where.ownerId) return false;
    if (where.name && record.name !== where.name) return false;
    if ('folderId' in where && record.folderId !== where.folderId) return false;
    if (where.deletionPending !== undefined && record.deletionPending !== where.deletionPending) return false;
    if (where.deletedAt === null && record.deletedAt !== null) return false;
    if (where.deletedAt && !(where.deletedAt instanceof Date) && !record.deletedAt) return false;
    if (where.deletedAt instanceof Date && record.deletedAt?.getTime() !== where.deletedAt.getTime()) return false;
    if (where.permissions && !['reader', 'editor'].includes(where.permissions.some.userId)) return false;
    return true;
  }
  const delegate = {
    create: async () => { throw new Error('Database create unavailable'); },
    findFirst: async ({ where }: { where: TestWhere }) => {
      const found = records.find((record) => matches(record, where));
      return found ? { ...found, permissions: where.permissions ? [{ role: where.permissions.some.userId === 'editor' ? 'EDITOR' : 'READER' }] : [] } : null;
    },
    findMany: async ({ where }: { where: TestWhere }) => records.filter((record) => matches(record, where)),
    update: async ({ where, data }: { where: TestWhere; data: Partial<StoredFile> }) => {
      const found = records.find((record) => matches(record, where));
      if (!found) throw new Error('Missing record');
      Object.assign(found, data, { updatedAt: new Date() }); return found;
    },
    updateMany: async ({ where, data }: { where: TestWhere; data: Partial<StoredFile> }) => {
      const found = records.filter((record) => matches(record, where)); found.forEach((record) => Object.assign(record, data)); return { count: found.length };
    },
    deleteMany: async ({ where }: { where: TestWhere }) => {
      if (failDatabaseDelete) throw new Error('Database delete unavailable');
      const index = records.findIndex((record) => matches(record, where)); if (index >= 0) records.splice(index, 1); return { count: index >= 0 ? 1 : 0 };
    },
  };
  const prisma = { storedFile: delegate, fileVisit: { upsert: async () => { visits += 1; } } } as unknown as PrismaService;
  prisma.$transaction = (async (callback: (tx: PrismaService) => Promise<unknown>) => {
    const snapshot = records.map((record) => ({ ...record }));
    try { return await callback(prisma); } catch (error) { records.splice(0, records.length, ...snapshot); throw error; }
  }) as unknown as typeof prisma.$transaction;
  const s3 = { send: async (command: unknown) => { if (command instanceof PutObjectCommand) { assert.ok(command.input.Body instanceof Readable); for await (const chunk of command.input.Body) { void chunk; } } if (command instanceof DeleteObjectCommand) { deletes += 1; if (failS3) throw new Error('S3 unavailable'); } return { Body: Readable.from('test') }; } } as unknown as S3Client;
  return { prisma, library: new FileLibraryService(prisma), files: new FilesService(prisma, { s3, sqs: {} as SQSClient }), records, file, setS3Failure: (value: boolean) => { failS3 = value; }, setDeleteFailure: (value: boolean) => { failDatabaseDelete = value; }, counts: () => ({ deletes, visits }) };
}

test('file roles enforce uniform reader denial, editor rename/trash, explicit replacement and personal access', async () => {
  const h = harness();
  await assert.rejects(h.library.rename(h.file.id, 'reader', 'x.txt'), ForbiddenException);
  await assert.rejects(h.files.moveToTrash(h.file.id, 'reader'), ForbiddenException);
  await assert.rejects(h.library.rename(h.file.id, 'stranger', 'x.txt'), NotFoundException);
  await assert.rejects(h.library.rename(h.file.id, 'owner', '../bad.txt'));
  await h.library.rename(h.file.id, 'editor', 'new.txt');
  assert.equal(h.records[0].name, 'new.txt');
  const target = { ...h.file, id: '22222222-2222-4222-8222-222222222222', name: 'target.txt' };
  h.records.push(target);
  await assert.rejects(h.library.rename(h.file.id, 'owner', target.name), (error: unknown) => typeof error === 'object' && error !== null && 'getStatus' in error && typeof error.getStatus === 'function' && error.getStatus() === 409);
  await h.library.rename(h.file.id, 'owner', target.name, target.id);
  assert.ok(h.records.find((record) => record.id === target.id)?.deletedAt);
  await h.library.recordAccess(h.file.id, 'reader');
  assert.equal(h.counts().visits, 1);
  await h.files.moveToTrash(h.file.id, 'editor');
  assert.ok(h.records.find((record) => record.id === h.file.id)?.deletedAt);
});

test('physical deletion keeps a retryable tombstone across S3 and database errors and blocks restore', async () => {
  const h = harness();
  await h.files.moveToTrash(h.file.id, 'owner');
  h.setS3Failure(true);
  await assert.rejects(h.files.permanentlyDelete(h.file.id, 'owner'), ServiceUnavailableException);
  assert.equal(h.file.deletionPending, true);
  await assert.rejects(h.files.restoreFromTrash(h.file.id, 'owner'), NotFoundException);
  await assert.rejects(h.files.getDownload(h.file.id, 'owner'), NotFoundException);
  h.setS3Failure(false); h.setDeleteFailure(true);
  await assert.rejects(h.files.permanentlyDelete(h.file.id, 'owner'), ServiceUnavailableException);
  assert.equal(h.records.length, 1);
  h.setDeleteFailure(false);
  await h.files.permanentlyDelete(h.file.id, 'owner');
  assert.equal(h.records.length, 0);
  assert.equal(h.counts().deletes, 3);
});

test('file REST rename validates names, denies readers and permits editors with documented statuses', async () => {
  const h = harness();
  const moduleRef = await Test.createTestingModule({ controllers: [FileLibraryController, FilesController], providers: [{ provide: FileLibraryService, useValue: h.library }, { provide: FilesService, useValue: h.files }] })
    .overrideGuard(SessionJwtGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => { headers: Record<string, string>; authContext?: { userId: string } } } }) => { const request = context.switchToHttp().getRequest(); request.authContext = { userId: request.headers['x-test-user'] ?? 'reader' }; return true; } }).compile();
  const app = moduleRef.createNestApplication(); app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  try {
    const address = app.getHttpServer().address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/files/${h.file.id}`;
    const send = (name: string, user: string) => fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-test-user': user }, body: JSON.stringify({ name }) });
    assert.equal((await send('new.txt', 'reader')).status, 403);
    assert.equal((await send('bad/name', 'editor')).status, 400);
    assert.equal((await send('new.txt', 'stranger')).status, 404);
    assert.equal((await send('new.txt', 'editor')).status, 200);
    assert.equal(h.records[0].name, 'new.txt');
    assert.equal((await fetch(url + '/trash', { method: 'POST', headers: { 'x-test-user': 'reader' } })).status, 403);
    assert.equal((await fetch(url + '/trash', { method: 'POST', headers: { 'x-test-user': 'editor' } })).status, 200);
    h.setS3Failure(true);
    assert.equal((await fetch(url + '/permanent', { method: 'DELETE', headers: { 'x-test-user': 'owner' } })).status, 503);
    h.setS3Failure(false);
    assert.equal((await fetch(url + '/permanent', { method: 'DELETE', headers: { 'x-test-user': 'owner' } })).status, 200);
  } finally { await app.close(); }
});


test('an upload conflict never replaces implicitly and a failed replacement retains the old file', async () => {
  const h = harness();
  await assert.rejects(h.files.upload(Readable.from('test'), h.file.name, 'text/plain', 4, 'owner'), (error: unknown) => {
    assert.ok(error instanceof Error && 'getStatus' in error && typeof error.getStatus === 'function'); assert.equal(error.getStatus(), 409); return true;
  });
  assert.equal(h.records[0].deletedAt, null);
  await assert.rejects(h.files.upload(Readable.from('test'), h.file.name, 'text/plain', 4, 'owner', { replaceFileId: h.file.id }), ServiceUnavailableException);
  assert.equal(h.records.length, 1); assert.equal(h.records[0].deletedAt, null);
});


test('restoring a colliding name requires confirmation and keeps the replaced file in trash', async () => {
  const h = harness(); h.file.deletedAt = new Date();
  const active = { ...h.file, id: '33333333-3333-4333-8333-333333333333', deletedAt: null };
  h.records.push(active);
  await assert.rejects(h.files.restoreFromTrash(h.file.id, 'owner'), (error: unknown) => {
    assert.ok(error instanceof Error && 'getStatus' in error && typeof error.getStatus === 'function'); assert.equal(error.getStatus(), 409); return true;
  });
  await h.files.restoreFromTrash(h.file.id, 'owner', active.id);
  assert.equal(h.records.find(file => file.id === h.file.id)?.deletedAt, null);
  assert.ok(h.records.find(file => file.id === active.id)?.deletedAt);
});
