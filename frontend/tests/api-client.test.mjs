import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiClient } from '../.test-dist/lib/api-client.js';
import { createSessionStore } from '../.test-dist/features/auth/session-store.js';

test('shares refresh across simultaneous unauthorized requests and preserves upload bodies', async () => {
  let refreshes = 0;
  let finishRefresh;
  let renewed = false;
  const requests = [];
  const body = new Blob(['upload']);
  const client = createApiClient(async (path, options) => {
    if (path === '/api/auth/refresh') {
      refreshes += 1;
      await new Promise((resolve) => { finishRefresh = resolve; });
      renewed = true;
      return new Response(null, { status: 204 });
    }
    requests.push(options);
    return new Response(null, { status: renewed ? 201 : 401 });
  });
  const first = client.authenticatedFetch('/api/files?name=one', { method: 'POST', body });
  const second = client.authenticatedFetch('/api/files?name=two', { method: 'POST', body });
  await Promise.resolve();
  finishRefresh();
  const responses = await Promise.all([first, second]);
  assert.equal(refreshes, 1);
  assert.deepEqual(responses.map((response) => response.status), [201, 201]);
  assert.equal(requests.length, 4);
  assert.ok(requests.every((request) => request.body === body && request.credentials === 'same-origin' && request.cache === 'no-store'));
});

test('clears the shared session when refresh is rejected, allowing the route guard to return to login', async () => {
  const user = { id: 'user', email: 'user@example.test', name: null, username: 'user', pictureUrl: null };
  const store = createSessionStore(async () => user);
  await store.initialize();
  const client = createApiClient(async () => new Response(null, { status: 401 }));
  const unsubscribe = client.subscribeToSessionExpiration(() => store.updateUser(null));
  const response = await client.authenticatedFetch('/api/files');
  assert.equal(response.status, 401);
  assert.deepEqual(store.getSnapshot(), { status: 'anonymous', user: null });
  unsubscribe();
});

test('reports expiry on failed refresh and on a retry that remains unauthorized', async () => {
  for (const refreshStatus of [200, 401, 503]) {
    let expirations = 0;
    const client = createApiClient(async (path) => new Response(null, { status: path === '/api/auth/refresh' ? refreshStatus : 401 }));
    client.subscribeToSessionExpiration(() => { expirations += 1; });
    assert.equal((await client.authenticatedFetch('/api/files')).status, 401);
    assert.equal(expirations, 1);
  }
});

test('expires the session when the refresh endpoint cannot be reached', async () => {
  let expired = false;
  const client = createApiClient(async (path) => {
    if (path === '/api/auth/refresh') throw new Error('Offline');
    return new Response(null, { status: 401 });
  });
  client.subscribeToSessionExpiration(() => { expired = true; });
  await assert.rejects(client.authenticatedFetch('/api/files'), /Offline/);
  assert.equal(expired, true);
});

test('does not renew or clear the session for a permission denial or server error', async () => {
  for (const status of [403, 500]) {
    let calls = 0;
    let expired = false;
    const client = createApiClient(async () => { calls += 1; return new Response(null, { status }); });
    client.subscribeToSessionExpiration(() => { expired = true; });
    assert.equal((await client.authenticatedFetch('/api/files')).status, status);
    assert.equal(calls, 1);
    assert.equal(expired, false);
  }
});

test('does not start another refresh for cleanup requests after session expiry or logout', async () => {
  for (const loggedOut of [false, true]) {
    let renewals = 0;
    const client = createApiClient(async (input) => {
      if (input === '/api/auth/logout') return new Response(null, { status: 204 });
      if (input === '/api/auth/refresh') renewals += 1;
      return new Response(null, { status: 401 });
    });
    if (loggedOut) await client.authenticatedFetch('/api/auth/logout', { method: 'POST' });
    else await client.authenticatedFetch('/api/files');
    await client.authenticatedFetch('/api/files/uploads/attempt', { method: 'DELETE' });
    assert.equal(renewals, loggedOut ? 0 : 1);
  }
});

test('cancelling an upload during session renewal prevents replaying its bytes', async () => {
  const controller = new AbortController();
  let finishRefresh;
  let requests = 0;
  const client = createApiClient(async () => {
    await new Promise((resolve) => { finishRefresh = resolve; });
    return new Response(null, { status: 204 });
  });
  const pending = client.authenticatedRequest('/api/files', { signal: controller.signal }, async () => {
    requests += 1;
    return new Response(null, { status: 401 });
  });
  await Promise.resolve();
  controller.abort();
  finishRefresh();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(requests, 1);
});
