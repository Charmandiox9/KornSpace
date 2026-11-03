import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { Readable, PassThrough } from 'node:stream';
import { test } from 'node:test';
import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createManagedHarness, deferred } from './helpers/managed-uploads.harness';

test('cancelling an active stream removes staged bytes and never publishes metadata', async () => {
  const harness = createManagedHarness();
  const operation = randomUUID();
  const source = new PassThrough();
  const pending = harness.managed.upload(source, 'file.txt', 'text/plain', 7, 'owner', operation, new AbortController().signal);
  const rejected = assert.rejects(pending);
  await new Promise((resolve) => setImmediate(resolve));
  source.write('par');
  assert.equal((await harness.managed.cancel('owner', operation)).phase, 'cancelling');
  await rejected;
  assert.equal((await harness.managed.status('owner', operation)).phase, 'cancelled');
  assert.equal(harness.storageSignals[0]?.aborted, true);
  assert.equal(harness.records.length, 0);
  assert.equal(harness.objects.size, 0);
  assert.equal(harness.indexed.size, 0);
  source.destroy();
});

test('a cancellation tombstone prevents a late POST or replay from saving a file', async () => {
  const harness = createManagedHarness();
  const operation = randomUUID();
  assert.equal((await harness.managed.cancel('owner', operation)).phase, 'cancelled');
  await assert.rejects(harness.managed.upload(Readable.from('content'), 'file.txt', 'text/plain', 7, 'owner', operation, new AbortController().signal), ConflictException);
  assert.equal(harness.objects.size, 0);
  assert.equal(harness.records.length, 0);
  assert.equal((await harness.managed.cancel('owner', operation)).phase, 'cancelled');
});

test('a full S3 body is still removed when cancellation wins before metadata confirmation', async () => {
  const harness = createManagedHarness();
  const entered = deferred();
  const release = deferred();
  harness.options.beforePutReturn = async () => { entered.resolve(); await release.promise; };
  const operation = randomUUID();
  const pending = harness.managed.upload(Readable.from('content'), 'file.txt', 'text/plain', 7, 'owner', operation, new AbortController().signal);
  const rejected = assert.rejects(pending);
  await entered.promise;
  assert.equal(harness.objects.size, 1);
  await harness.managed.cancel('owner', operation);
  assert.equal(harness.storageSignals[0]?.aborted, false);
  release.resolve();
  await rejected;
  assert.equal((await harness.managed.status('owner', operation)).phase, 'cancelled');
  assert.equal(harness.objects.size, 0);
  assert.equal(harness.records.length, 0);
});

test('confirmation wins a late cancellation and transport disconnect without deleting a complete file', async () => {
  const harness = createManagedHarness();
  const entered = deferred();
  const release = deferred();
  harness.options.beforeCreate = async () => { entered.resolve(); await release.promise; };
  const operation = randomUUID();
  const connection = new AbortController();
  const pending = harness.managed.upload(Readable.from('content'), 'file.txt', 'text/plain', 7, 'owner', operation, connection.signal);
  await entered.promise;
  connection.abort();
  assert.equal((await harness.managed.cancel('owner', operation)).phase, 'confirming');
  release.resolve();
  const result = await pending;
  assert.equal((await harness.managed.cancel('owner', operation)).phase, 'completed');
  assert.equal(harness.objects.size, 1);
  assert.equal(harness.records[0].id, result.file.id);
  assert.equal(harness.records[0].status, 'AVAILABLE');
});

test('a database error during confirmation remains a real failure after a cancellation request', async () => {
  const harness = createManagedHarness();
  const entered = deferred();
  const release = deferred();
  harness.options.failCreate = true;
  harness.options.beforeCreate = async () => { entered.resolve(); await release.promise; };
  const operation = randomUUID();
  const pending = harness.managed.upload(Readable.from('content'), 'file.txt', 'text/plain', 7, 'owner', operation, new AbortController().signal);
  const rejected = assert.rejects(pending);
  await entered.promise;
  assert.equal((await harness.managed.cancel('owner', operation)).phase, 'confirming');
  release.resolve();
  await rejected;
  assert.equal((await harness.managed.status('owner', operation)).phase, 'failed');
  assert.equal(harness.objects.size, 0);
  assert.equal(harness.records.length, 0);
});

test('cleanup failures remain durable pending work and retry idempotently', async () => {
  const harness = createManagedHarness();
  const entered = deferred();
  const release = deferred();
  harness.options.failDelete = true;
  harness.options.beforePutReturn = async () => { entered.resolve(); await release.promise; };
  const operation = randomUUID();
  const pending = harness.managed.upload(Readable.from('content'), 'file.txt', 'text/plain', 7, 'owner', operation, new AbortController().signal);
  const rejected = assert.rejects(pending);
  await entered.promise;
  await harness.managed.cancel('owner', operation);
  release.resolve();
  await rejected;
  assert.equal((await harness.managed.status('owner', operation)).phase, 'cleanupPending');
  assert.equal(harness.indexed.size, 1);
  assert.equal(harness.objects.size, 1);
  assert.equal(harness.records.length, 0);
  harness.options.failDelete = false;
  assert.equal((await harness.managed.status('owner', operation)).phase, 'cancelled');
  assert.equal(harness.objects.size, 0);
  assert.equal(harness.indexed.size, 0);
  assert.equal([...harness.ttls.values()][0], 86400);
});

test('upload identifiers are isolated by owner and simultaneous cancellation/confirmation has one winner', async () => {
  const harness = createManagedHarness();
  const operation = randomUUID();
  await harness.registry.begin('owner', operation, false);
  assert.equal((await harness.managed.cancel('other-owner', operation)).phase, 'cancelled');
  assert.equal((await harness.registry.get('owner', operation))?.phase, 'uploading');
  await assert.rejects(harness.managed.status('third-owner', operation), NotFoundException);
  await Promise.all([
    harness.registry.requestCancellation('owner', operation),
    harness.registry.update('owner', operation, (record) => record.phase === 'uploading' ? { ...record, phase: 'confirming' } : record),
  ]);
  const state = await harness.registry.get('owner', operation);
  assert.ok(state?.phase === 'cancelling' || state?.phase === 'confirming');
  assert.equal((await harness.registry.requestCancellation('owner', operation)).phase, state.phase);
});

test('a restarted backend reconciles expired attempts and never downloads incomplete data', async () => {
  const harness = createManagedHarness();
  const operation = randomUUID();
  const record = await harness.registry.begin('owner', operation, false);
  harness.objects.add(`files/${record.fileId}`);
  await harness.registry.update('owner', operation, (current) => ({ ...current, leaseUntil: 0 }));
  assert.equal((await harness.managed.status('owner', operation)).phase, 'failed');
  assert.equal(harness.objects.size, 0);
  await assert.rejects(harness.files.getDownload(record.fileId, 'owner'), NotFoundException);
});

test('recovery preserves fully persisted files whose confirmation response was lost', async () => {
  const harness = createManagedHarness();
  const operation = randomUUID();
  const record = await harness.registry.begin('owner', operation, false);
  await harness.registry.update('owner', operation, (current) => ({ ...current, phase: 'confirming', leaseUntil: 0 }));
  await harness.files.upload(Readable.from('content'), 'file.txt', 'text/plain', 7, 'owner', { fileId: record.fileId });
  assert.equal((await harness.managed.status('owner', operation)).phase, 'completed');
  assert.equal(harness.objects.size, 1);
  assert.equal(harness.records.length, 1);
});

test('cleanup disables downloads before deleting storage and retains FAILED metadata while S3 is unavailable', async () => {
  const harness = createManagedHarness();
  const file = await harness.files.upload(Readable.from('content'), 'file.txt', 'text/plain', 7, 'owner');
  harness.options.failDelete = true;
  await assert.rejects(harness.files.cleanupUpload(file.file.id));
  assert.equal(harness.records[0].status, 'FAILED');
  await assert.rejects(harness.files.getDownload(file.file.id, 'owner'), ServiceUnavailableException);
  harness.options.failDelete = false;
  await harness.files.cleanupUpload(file.file.id);
  await harness.files.cleanupUpload(file.file.id);
  assert.equal(harness.objects.size, 0);
  assert.equal(harness.records.length, 0);
});
