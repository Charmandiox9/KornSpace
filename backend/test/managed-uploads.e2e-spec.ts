import { strict as assert } from 'node:assert';
import { createHash, randomUUID } from 'node:crypto';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FilesController } from '../src/files/files.controller';
import { FilesService } from '../src/files/files.service';
import { ManagedUploadsService } from '../src/files/managed-uploads.service';
import { SessionJwtGuard } from '../src/auth/session-jwt.guard';
import { createManagedHarness } from './helpers/managed-uploads.harness';

async function until(check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Upload state did not settle');
}

async function createUploadApp() {
  const harness = createManagedHarness();
  const module = await Test.createTestingModule({
    controllers: [FilesController],
    providers: [
      { provide: FilesService, useValue: harness.files },
      { provide: ManagedUploadsService, useValue: harness.managed },
    ],
  }).overrideGuard(SessionJwtGuard).useValue({
    canActivate: (context: { switchToHttp: () => { getRequest: () => { headers: Record<string, string | undefined>; authContext?: { userId: string } } } }) => {
      const incoming = context.switchToHttp().getRequest();
      const userId = incoming.headers['x-test-user'];
      if (!userId) throw new UnauthorizedException();
      incoming.authContext = { userId };
      return true;
    },
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}/api/files`;
  return { app, base, harness };
}

test('HTTP cancellation of an active body cleans storage, isolates owners, and permits a fresh retry', async () => {
  const { app, base, harness } = await createUploadApp();
  const operationId = randomUUID();
  const headers = { 'x-test-user': 'owner' };
  const upload = request(`${base}?name=partial.txt`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/octet-stream', 'content-length': '100', 'x-upload-id': operationId },
  });
  upload.on('error', () => undefined);
  upload.on('response', (response) => response.resume());
  try {
    assert.equal((await fetch(`${base}/uploads/${operationId}`)).status, 401);
    upload.write('par');
    await until(async () => (await harness.registry.get('owner', operationId))?.phase === 'uploading');
    const fileId = (await harness.registry.get('owner', operationId))?.fileId;
    assert.equal((await fetch(`${base}/uploads/${operationId}`, { headers: { 'x-test-user': 'other-owner' } })).status, 404);
    const cancelled = await fetch(`${base}/uploads/${operationId}`, { method: 'DELETE', headers });
    assert.equal(cancelled.status, 200);
    upload.destroy();
    await until(async () => (await harness.registry.get('owner', operationId))?.phase === 'cancelled');
    assert.equal(harness.records.length, 0);
    assert.equal(harness.objects.size, 0);
    assert.equal((await fetch(`${base}/${fileId}`, { headers })).status, 404);
    assert.equal((await fetch(`${base}/uploads/${operationId}`, { method: 'DELETE', headers })).status, 200);

    const replay = await fetch(`${base}?name=retry.txt`, {
      method: 'POST', headers: { ...headers, 'content-type': 'text/plain', 'x-upload-id': operationId }, body: 'content',
    });
    assert.equal(replay.status, 409);
    const retryId = randomUUID();
    const retry = await fetch(`${base}?name=retry.txt`, {
      method: 'POST', headers: { ...headers, 'content-type': 'text/plain', 'x-upload-id': retryId }, body: 'content',
    });
    assert.equal(retry.status, 201);
    const lateCancel = await fetch(`${base}/uploads/${retryId}`, { method: 'DELETE', headers });
    const lateResult: unknown = await lateCancel.json();
    assert.ok(typeof lateResult === 'object' && lateResult !== null && 'phase' in lateResult);
    assert.equal(lateResult.phase, 'completed');
    assert.equal(harness.records.length, 1);
    assert.equal(harness.objects.size, 1);
  } finally {
    upload.destroy();
    await app.close();
  }
});

test('HTTP multipart uploads validate ordering and ownership, assemble bytes, enqueue and support cancellation', async () => {
  const { app, base, harness } = await createUploadApp();
  const headers = { 'x-test-user': 'owner' };
  const start = (operation: string, sizeBytes: number) => fetch(`${base}/uploads/${operation}`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'setup.exe', contentType: 'application/octet-stream', sizeBytes }),
  });
  const part = (path: string, bytes: Uint8Array<ArrayBuffer>, owner = 'owner') => fetch(path, {
    method: 'PUT', headers: { 'x-test-user': owner, 'content-type': 'application/octet-stream' }, body: bytes,
  });
  const chunk = Buffer.alloc(16 * 1024 * 1024, 42);
  const tail = Buffer.from([1, 2, 3]);
  const operation = randomUUID();
  const path = `${base}/uploads/${operation}`;
  try {
    assert.equal((await start(randomUUID(), 1024 ** 3 + 1)).status, 413);
    const started = await start(operation, chunk.length + tail.length);
    assert.equal(started.status, 201);
    assert.deepEqual(await started.json(), { partSizeBytes: chunk.length });
    assert.equal((await start(operation, chunk.length + tail.length)).status, 409);
    assert.equal((await part(`${path}/parts/1`, tail, 'another')).status, 404);
    assert.equal((await part(`${path}/parts/2`, tail)).status, 400);
    assert.equal((await part(`${path}/parts/1`, tail)).status, 400);
    assert.equal((await fetch(`${path}/complete`, { method: 'POST', headers })).status, 400);
    assert.equal((await part(`${path}/parts/1`, chunk)).status, 204);
    assert.equal((await part(`${path}/parts/2`, tail)).status, 204);
    assert.equal(harness.records.length, 0);
    assert.equal((await fetch(`${path}/complete`, { method: 'POST', headers })).status, 202);
    assert.equal(harness.records.length, 1);
    assert.equal(harness.records[0].status, 'PROCESSING');
    assert.deepEqual(harness.multipartObjects.get(harness.records[0].s3Key), Buffer.concat([chunk, tail]));
    assert.equal(harness.processingMessages.length, 1);
    assert.equal(harness.multipartUploads.size, 0);

    const cancelled = randomUUID();
    const cancelledPath = `${base}/uploads/${cancelled}`;
    assert.equal((await start(cancelled, 3)).status, 201);
    assert.equal((await part(`${cancelledPath}/parts/1`, tail)).status, 204);
    const cancelResponse = await fetch(cancelledPath, { method: 'DELETE', headers });
    assert.deepEqual(await cancelResponse.json(), { phase: 'cancelled', file: null, asynchronous: false });
    assert.equal(harness.multipartUploads.size, 0);
    assert.equal((await fetch(`${cancelledPath}/complete`, { method: 'POST', headers })).status, 409);
    assert.equal(harness.records.length, 1);

    const small = randomUUID();
    const smallPath = `${base}/uploads/${small}`;
    assert.equal((await start(small, tail.length)).status, 201);
    assert.equal((await part(`${smallPath}/parts/1`, tail)).status, 204);
    const completed = await fetch(`${smallPath}/complete`, { method: 'POST', headers });
    assert.equal(completed.status, 201);
    assert.equal(harness.records[1].checksum, createHash('sha256').update(tail).digest('hex'));
    assert.equal(harness.processingMessages.length, 1);
  } finally {
    await app.close();
  }
});
