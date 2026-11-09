import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { ForbiddenException, NotFoundException, ServiceUnavailableException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GraphQLModule, GqlExecutionContext } from '@nestjs/graphql';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import type { ExecutionContext } from '@nestjs/common';
import { FileLibraryResolver } from '../src/files/file-library.resolver';
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
  const file: StoredFile = { id: '11111111-1111-4111-8111-111111111111', ownerId: 'owner', folderId: null, name: 'one.txt', description: null, contentType: 'text/plain', sizeBytes: 4n, s3Key: 'files/one', checksum: 'hash', status: 'AVAILABLE', createdAt: now, updatedAt: now, deletedAt: null, deletionPending: false };
  const records = [file];
  const recipients = [
    { id: '44444444-4444-4444-8444-444444444444', username: 'newperson', email: 'new@example.test', name: 'New Person' },
    { id: 'owner', username: 'owner', email: 'owner@example.test', name: 'Owner' },
  ];
  const grants = new Map<string, 'READER' | 'EDITOR'>([['reader', 'READER'], ['editor', 'EDITOR']]);
  let recipientQueries = 0;
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
    if (where.permissions && !grants.has(where.permissions.some.userId)) return false;
    return true;
  }
  const delegate = {
    create: async () => { throw new Error('Database create unavailable'); },
    findFirst: async ({ where }: { where: TestWhere }) => {
      const found = records.find((record) => matches(record, where));
      return found ? { ...found, permissions: where.permissions ? [{ role: grants.get(where.permissions.some.userId) }] : [] } : null;
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
  const prisma = { user: {
    findUnique: async () => ({ name: 'Owner', email: 'owner@example.test' }),
    findMany: async ({ where }: { where: { id: { not: string }; email?: { equals: string }; username?: { equals: string } } }) => {
    recipientQueries += 1;
    return recipients.filter((user) => user.id !== where.id.not && (where.email ? user.email.toLowerCase() === where.email.equals.toLowerCase() : user.username.toLowerCase() === where.username?.equals.toLowerCase()));
  } }, resourceActivity: { create: async () => ({}), updateMany: async () => ({ count: 0 }), findMany: async () => [], deleteMany: async () => ({ count: 0 }) }, filePermission: {
    findMany: async () => Array.from(grants, ([userId, role]) => ({ userId, role, user: { email: recipients.find((user) => user.id === userId)?.email ?? userId + '@example.test', username: recipients.find((user) => user.id === userId)?.username ?? userId } })),
    updateMany: async ({ where, data }: { where: { userId: string }; data: { role: 'READER' | 'EDITOR' } }) => { if (!grants.has(where.userId)) return { count: 0 }; grants.set(where.userId, data.role); return { count: 1 }; },
    upsert: async ({ create }: { create: { userId: string; role: 'READER' | 'EDITOR' } }) => { grants.set(create.userId, create.role); return { userId: create.userId, role: create.role }; },
    deleteMany: async ({ where }: { where: { userId: string } }) => { grants.delete(where.userId); return { count: 1 }; },
  }, storedFile: delegate, fileVisit: { upsert: async () => { visits += 1; } } } as unknown as PrismaService;
  prisma.$transaction = (async (callback: (tx: PrismaService) => Promise<unknown>) => {
    const snapshot = records.map((record) => ({ ...record }));
    try { return await callback(prisma); } catch (error) { records.splice(0, records.length, ...snapshot); throw error; }
  }) as unknown as typeof prisma.$transaction;
  const s3 = { send: async (command: unknown) => { if (command instanceof PutObjectCommand) { assert.ok(command.input.Body instanceof Readable); for await (const chunk of command.input.Body) { void chunk; } } if (command instanceof DeleteObjectCommand) { deletes += 1; if (failS3) throw new Error('S3 unavailable'); } return { Body: Readable.from('test') }; } } as unknown as S3Client;
  return { grants, recipients, getRecipientQueries: () => recipientQueries, prisma, library: new FileLibraryService(prisma), files: new FilesService(prisma, { s3, sqs: {} as SQSClient }), records, file, setS3Failure: (value: boolean) => { failS3 = value; }, setDeleteFailure: (value: boolean) => { failDatabaseDelete = value; }, counts: () => ({ deletes, visits }) };
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
    const recipient = h.recipients[0];
    const lookup = await fetch(`${url}/recipients?identifier=%40NEWPERSON`, { headers: { 'x-test-user': 'owner' } });
    assert.equal(lookup.status, 200);
    assert.deepEqual(await lookup.json(), { userId: recipient.id, username: recipient.username, email: recipient.email, name: recipient.name });
    assert.equal((await fetch(`${url}/recipients?identifier=newperson`, { headers: { 'x-test-user': 'reader' } })).status, 404);
    assert.equal((await fetch(`${url}/recipients?identifier=ne`, { headers: { 'x-test-user': 'owner' } })).status, 400);
    const grant = (body: Record<string, string>) => fetch(`${url}/permissions`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-test-user': 'owner' }, body: JSON.stringify(body) });
    assert.equal((await grant({ identifier: recipient.username, recipientId: recipient.id, role: 'READER' })).status, 200);
    const sharedDownload = await fetch(url, { headers: { 'x-test-user': recipient.id } });
    assert.equal(sharedDownload.status, 200);
    assert.equal(await sharedDownload.text(), 'test');
    assert.equal((await send('denied.txt', recipient.id)).status, 403);
    assert.equal((await grant({ email: recipient.email, role: 'EDITOR' })).status, 200);
    assert.equal((await send('allowed.txt', recipient.id)).status, 200);
    const permissionList = await fetch(url + '/permissions', { headers: { 'x-test-user': 'owner' } });
    assert.equal(permissionList.status, 200);
    const listed = await permissionList.json() as Array<{ userId: string; role: string }>;
    assert.equal(listed.find((row) => row.userId === recipient.id)?.role, 'EDITOR');
    assert.equal((await fetch(url + '/permissions', { headers: { 'x-test-user': recipient.id } })).status, 404);
    assert.equal((await fetch(url + '/permissions/' + recipient.id, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-test-user': 'owner' }, body: JSON.stringify({ role: 'READER' }) })).status, 204);
    assert.equal((await send('denied-again.txt', recipient.id)).status, 403);
    assert.equal((await fetch(`${url}/permissions/${recipient.id}`, { method: 'DELETE', headers: { 'x-test-user': 'owner' } })).status, 204);
    assert.equal((await fetch(url, { headers: { 'x-test-user': recipient.id } })).status, 404);
    assert.equal((await grant({ identifier: recipient.username, email: recipient.email, role: 'READER' })).status, 400);
    assert.equal((await grant({ identifier: recipient.username, recipientId: '55555555-5555-4555-8555-555555555555', role: 'READER' })).status, 409);
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


test('sharing resolves exact email and username, persists reader/editor permissions and supports revocation', async () => {
  const h = harness(); const target = h.recipients[0];
  assert.equal((await h.library.resolveRecipient(h.file.id, 'owner', '@NEWPERSON')).email, target.email);
  assert.equal((await h.library.resolveRecipient(h.file.id, 'owner', 'NEW@example.test')).username, target.username);
  const previousQueries = h.getRecipientQueries();
  await assert.rejects(h.library.resolveRecipient(h.file.id, 'reader', target.username), NotFoundException);
  assert.equal(h.getRecipientQueries(), previousQueries);
  await assert.rejects(h.library.resolveRecipient(h.file.id, 'owner', 'newpers'), NotFoundException);
  await assert.rejects(h.library.resolveRecipient(h.file.id, 'owner', 'owner'), NotFoundException);
  await h.library.grant(h.file.id, 'owner', target.username, 'READER', target.id);
  assert.equal(h.grants.get(target.id), 'READER');
  const download = await h.files.getDownload(h.file.id, target.id); download.body.destroy();
  await assert.rejects(h.library.rename(h.file.id, target.id, 'new.txt'), ForbiddenException);
  await h.library.grant(h.file.id, 'owner', target.email, 'EDITOR', target.id);
  assert.equal(h.grants.get(target.id), 'EDITOR');
  await h.library.rename(h.file.id, target.id, 'shared.txt');
  await h.library.revoke(h.file.id, 'owner', target.id);
  await assert.rejects(h.files.getDownload(h.file.id, target.id), NotFoundException);
});

test('sharing rejects ambiguous emails and a changed confirmation target without granting permission', async () => {
  const h = harness(); const target = h.recipients[0];
  await assert.rejects(h.library.grant(h.file.id, 'owner', target.username, 'READER', '55555555-5555-4555-8555-555555555555'));
  assert.equal(h.grants.has(target.id), false);
  h.recipients.push({ ...target, id: '55555555-5555-4555-8555-555555555555', username: 'otherperson' });
  await assert.rejects(h.library.resolveRecipient(h.file.id, 'owner', target.email), NotFoundException);
});


test('storage GraphQL counts only owned metadata including trash and rejects anonymous access', async () => {
  const h = harness();
  h.records.push({ ...h.file, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sizeBytes: 9n, deletedAt: new Date() });
  h.records.push({ ...h.file, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ownerId: 'other', sizeBytes: 99n });
  const module = await Test.createTestingModule({
    imports: [GraphQLModule.forRoot<ApolloDriverConfig>({ driver: ApolloDriver, autoSchemaFile: true, context: ({ req }: { req: { headers: Record<string, string | undefined> } }) => ({ req: { authContext: req.headers['x-test-user'] ? { userId: req.headers['x-test-user'] } : undefined } }) })],
    providers: [FileLibraryResolver, { provide: FileLibraryService, useValue: h.library }],
  }).overrideGuard(SessionJwtGuard).useValue({ canActivate: (context: ExecutionContext) => Boolean(GqlExecutionContext.create(context).getContext<{ req: { authContext?: { userId: string } } }>().req.authContext) }).compile();
  const app = module.createNestApplication(); await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address() as AddressInfo;
  async function query(userId?: string) {
    const response = await fetch(`http://127.0.0.1:${address.port}/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(userId ? { 'x-test-user': userId } : {}) }, body: JSON.stringify({ query: '{ storageUsage { totalBytes trashBytes files { id ownerId deletedAt sizeBytes } } }' }) });
    return response.json() as Promise<{ data?: { storageUsage: { totalBytes: number; trashBytes: number; files: { id: string; ownerId: string }[] } }; errors?: unknown[] }>;
  }
  try {
    assert.ok((await query()).errors?.length);
    const owned = (await query('owner')).data!.storageUsage;
    assert.equal(owned.totalBytes, 13); assert.equal(owned.trashBytes, 9); assert.equal(owned.files.length, 2);
    assert.ok(owned.files.every((file) => file.ownerId === 'owner'));
    assert.deepEqual((await query('reader')).data!.storageUsage, { totalBytes: 0, trashBytes: 0, files: [] });
    assert.equal((await query('other')).data!.storageUsage.totalBytes, 99);
  } finally { await app.close(); }
});
