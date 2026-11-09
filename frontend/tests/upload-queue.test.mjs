import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUploadQueue as createQueue, maxUploadBytes, validateUpload } from '../.test-dist/features/files/upload-queue.js';

const createUploadQueue = (options) => createQueue({ cancelUpload: async () => 'cancelled', ...options });

const tick = () => new Promise((resolve) => setImmediate(resolve));
const file = (name) => new File(['content'], name, { type: 'text/plain' });

test('validates each file, accepting exactly 1 GiB and rejecting empty or invalid filenames', () => {
  assert.equal(validateUpload({ name: 'large.bin', size: maxUploadBytes }), null);
  assert.equal(validateUpload({ name: 'large.bin', size: maxUploadBytes + 1 }), 'tooLarge');
  assert.equal(validateUpload({ name: 'empty.txt', size: 0 }), 'empty');
  assert.equal(validateUpload({ name: 'bad\u0000name', size: 1 }), 'invalidName');
  assert.equal(validateUpload({ name: 'a'.repeat(256), size: 1 }), 'invalidName');
});

test('keeps the selected destination folder with each queued upload', async () => {
  const destinations = [];
  const refreshedDestinations = [];
  const queue = createUploadQueue({
    upload: async (_item, _signal, _progress, _operationId, folderId) => {
      destinations.push(folderId);
      return 'uploaded';
    },
    onUploaded: async (folderId) => { refreshedDestinations.push(folderId); },
  });

  queue.enqueue([file('one.txt'), file('two.txt')], 'folder-123', 'Reports');
  await tick();

  assert.deepEqual(destinations, ['folder-123', 'folder-123']);
  assert.deepEqual(refreshedDestinations, ['folder-123', 'folder-123']);
  assert.ok(queue.getSnapshot().every((item) => item.status === 'uploaded'));
  assert.ok(queue.getSnapshot().every((item) => item.destinationName === 'Reports'));
});

test('isolates invalid files and partial failures while refreshing after each successful upload', async () => {
  const sent = [];
  let refreshes = 0;
  const queue = createUploadQueue({
    upload: async (item) => {
      sent.push(item.name);
      if (item.name === 'failed.txt') throw new Error('Storage unavailable');
      return item.name === 'processing.txt' ? 'processing' : 'uploaded';
    },
    onUploaded: async () => { refreshes += 1; },
  });
  queue.enqueue([file('ok.txt'), new File([], 'empty.txt'), file('failed.txt'), file('processing.txt')]);
  await tick();
  assert.deepEqual(sent, ['ok.txt', 'failed.txt', 'processing.txt']);
  assert.deepEqual(queue.getSnapshot().map((item) => item.status), ['uploaded', 'invalid', 'failed', 'processing']);
  assert.equal(refreshes, 2);
});

test('limits concurrent work and accepts new batches while uploads are active', async () => {
  const completions = [];
  let active = 0;
  let peak = 0;
  const queue = createUploadQueue({
    concurrency: 2,
    upload: async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => completions.push(resolve));
      active -= 1;
      return 'uploaded';
    },
    onUploaded: async () => undefined,
  });
  queue.enqueue([file('one.txt'), file('two.txt'), file('three.txt')]);
  queue.enqueue([file('four.txt')]);
  assert.deepEqual(queue.getSnapshot().map((item) => item.status), ['uploading', 'uploading', 'queued', 'queued']);
  completions.splice(0).forEach((resolve) => resolve());
  await tick();
  completions.splice(0).forEach((resolve) => resolve());
  await tick();
  assert.equal(peak, 2);
  assert.ok(queue.getSnapshot().every((item) => item.status === 'uploaded'));
});

test('aborts pending work on logout and ignores late results from the previous user', async () => {
  let signal;
  let finish;
  let refreshes = 0;
  const queue = createUploadQueue({
    upload: async (_file, uploadSignal) => {
      signal = uploadSignal;
      await new Promise((resolve) => { finish = resolve; });
      return 'uploaded';
    },
    onUploaded: async () => { refreshes += 1; },
  });
  queue.enqueue([file('private.txt')]);
  queue.cancel();
  finish();
  await tick();
  assert.equal(signal.aborted, true);
  assert.deepEqual(queue.getSnapshot(), []);
  assert.equal(refreshes, 0);
});

test('publishes real byte progress and waits for server confirmation after reaching 100%', async () => {
  let report;
  let finish;
  const queue = createUploadQueue({
    upload: async (_file, _signal, onProgress) => {
      report = onProgress;
      return new Promise((resolve) => { finish = resolve; });
    }, onUploaded: async () => undefined,
  });
  queue.enqueue([file('progress.txt')]);
  report({ loadedBytes: 3, totalBytes: 7 });
  assert.equal(queue.getSnapshot()[0].loadedBytes, 3);
  assert.equal(queue.getSnapshot()[0].status, 'uploading');
  report({ loadedBytes: 7, totalBytes: 7 });
  assert.equal(queue.getSnapshot()[0].status, 'confirming');
  finish('uploaded');
  await tick();
  assert.equal(queue.getSnapshot()[0].status, 'uploaded');
});

test('cancels only the requested upload, waits for cleanup, and retries with a fresh operation ID', async () => {
  const ids = [];
  const signals = [];
  let confirm;
  const queue = createUploadQueue({
    upload: (_file, signal, _progress, operationId) => {
      ids.push(operationId);
      signals.push(signal);
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    },
    cancelUpload: () => new Promise((resolve) => { confirm = resolve; }),
    onUploaded: async () => undefined,
  });
  queue.enqueue([file('one.txt'), file('two.txt')]);
  queue.cancelItem('1');
  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
  assert.equal(queue.getSnapshot()[0].status, 'cancelling');
  queue.retryItem('1');
  assert.equal(ids.length, 2);
  confirm('cancelled');
  await tick();
  assert.equal(queue.getSnapshot()[0].status, 'cancelled');
  queue.retryItem('1');
  assert.equal(ids.length, 3);
  assert.notEqual(ids[0], ids[2]);
  assert.equal(queue.getSnapshot()[0].loadedBytes, 0);
  queue.cancel();
});

test('preserves a complete upload when confirmation wins a cancellation race', async () => {
  let finish;
  let acknowledge;
  let refreshed = 0;
  const queue = createUploadQueue({
    upload: async () => new Promise((resolve) => { finish = resolve; }),
    cancelUpload: async () => new Promise((resolve) => { acknowledge = resolve; }),
    onUploaded: async () => { refreshed += 1; },
  });
  queue.enqueue([file('complete.txt')]);
  finish('uploaded');
  queue.cancelItem('1');
  acknowledge('uploaded');
  await tick();
  assert.equal(queue.getSnapshot()[0].status, 'uploaded');
  assert.equal(queue.getSnapshot()[0].completionWon, true);
  assert.equal(refreshed, 1);
});

test('keeps real failures distinct from cancellation and does not retry an unconfirmed outcome', async () => {
  let rejectUpload;
  let rejectCancellation;
  let checks = 0;
  const queue = createUploadQueue({
    upload: async () => new Promise((_resolve, reject) => { rejectUpload = reject; }),
    cancelUpload: async () => {
      checks += 1;
      if (checks > 1) return 'failed';
      return new Promise((_resolve, reject) => { rejectCancellation = reject; });
    },
    onUploaded: async () => undefined,
  });
  queue.enqueue([file('failed.txt')]);
  queue.cancelItem('1');
  rejectUpload(new Error('Storage failed'));
  rejectCancellation(new Error('Offline'));
  await tick();
  assert.equal(queue.getSnapshot()[0].status, 'cancelFailed');
  queue.retryItem('1');
  assert.equal(queue.getSnapshot()[0].status, 'cancelFailed');
  queue.cancelItem('1');
  await tick();
  assert.equal(queue.getSnapshot()[0].status, 'failed');
});

test('cancels a queued item without a server request or affecting active uploads', async () => {
  let cancellations = 0;
  const queue = createUploadQueue({
    concurrency: 1,
    upload: async () => new Promise(() => undefined),
    cancelUpload: async () => { cancellations += 1; return 'cancelled'; },
    onUploaded: async () => undefined,
  });
  queue.enqueue([file('one.txt'), file('two.txt')]);
  queue.cancelItem('2');
  assert.equal(queue.getSnapshot()[0].status, 'uploading');
  assert.equal(queue.getSnapshot()[1].status, 'cancelled');
  assert.equal(cancellations, 0);
  queue.cancel();
});
