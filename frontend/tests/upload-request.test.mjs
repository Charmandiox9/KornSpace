import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUploadTransport } from '../.test-dist/lib/upload-request.js';

class FakeRequest extends EventTarget {
  upload = new EventTarget();
  status = 201;
  responseText = '{}';
  aborted = false;
  headers = new Map();
  open() {}
  send(body) { this.body = body; }
  setRequestHeader(name, value) { this.headers.set(name, value); }
  getResponseHeader() { return 'application/json'; }
  abort() { this.aborted = true; this.dispatchEvent(new Event('abort')); }
}

test('XHR reports actual byte events and resolves only after the server responds', async () => {
  const xhr = new FakeRequest();
  const updates = [];
  const send = createUploadTransport((progress) => updates.push(progress), () => xhr);
  const blob = new Blob(['1234567']);
  const response = send('/api/files', { method: 'POST', body: blob, headers: { 'X-Upload-Id': 'attempt' } });
  const event = new Event('progress');
  Object.assign(event, { lengthComputable: true, loaded: 3, total: 7 });
  xhr.upload.dispatchEvent(event);
  xhr.upload.dispatchEvent(new Event('load'));
  assert.deepEqual(updates.map((update) => update.loadedBytes), [0, 3, 7]);
  assert.equal(xhr.headers.get('x-upload-id'), 'attempt');
  assert.equal(xhr.body, blob);
  xhr.dispatchEvent(new Event('load'));
  assert.equal((await response).status, 201);
});

test('XHR abort rejects once and ignores a late success or failure event', async () => {
  for (const late of ['load', 'error']) {
    const controller = new AbortController();
    const xhr = new FakeRequest();
    const send = createUploadTransport(() => undefined, () => xhr);
    const request = send('/api/files', { method: 'POST', body: new Blob(['file']), signal: controller.signal });
    controller.abort();
    xhr.dispatchEvent(new Event(late));
    await assert.rejects(request, { name: 'AbortError' });
    assert.equal(xhr.aborted, true);
  }
});

test('a pre-aborted signal never sends a request', async () => {
  const controller = new AbortController();
  controller.abort();
  const send = createUploadTransport(() => undefined, () => { throw new Error('Must not construct XHR'); });
  await assert.rejects(send('/api/files', { body: new Blob(['file']), signal: controller.signal }), { name: 'AbortError' });
});

test('a successful response stays successful when a later abort signal arrives', async () => {
  const controller = new AbortController();
  const xhr = new FakeRequest();
  const send = createUploadTransport(() => undefined, () => xhr);
  const result = send('/api/files', { body: new Blob(['file']), signal: controller.signal });
  xhr.dispatchEvent(new Event('load'));
  assert.equal((await result).status, 201);
  controller.abort();
  assert.equal(xhr.aborted, false);
});

test('cancelling during the initial progress callback prevents sending bytes', async () => {
  const controller = new AbortController();
  const xhr = new FakeRequest();
  const send = createUploadTransport(() => controller.abort(), () => xhr);
  await assert.rejects(send('/api/files', { body: new Blob(['file']), signal: controller.signal }), { name: 'AbortError' });
  assert.equal(xhr.body, undefined);
});
