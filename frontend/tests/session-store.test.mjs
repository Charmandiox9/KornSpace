import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionStore } from '../.test-dist/features/auth/session-store.js';

const user = { id: 'user-1', email: 'user@example.test', name: null, username: 'user', pictureUrl: null };

test('shares one initial check across concurrent consumers and later navigation subscriptions', async () => {
  let checks = 0;
  const store = createSessionStore(async () => { checks += 1; return user; });
  const unsubscribe = store.subscribe(() => undefined);
  await Promise.all([store.initialize(), store.initialize()]);
  unsubscribe();
  const unsubscribeNextPage = store.subscribe(() => undefined);
  await store.initialize();
  assert.equal(checks, 1);
  assert.deepEqual(store.getSnapshot(), { status: 'authenticated', user });
  unsubscribeNextPage();
});

test('starts a fresh check when a new application instance opens', async () => {
  let checks = 0;
  const load = async () => { checks += 1; return user; };
  await createSessionStore(load).initialize();
  await createSessionStore(load).initialize();
  assert.equal(checks, 2);
});

test('does not restore an expired session when an earlier check finishes late', async () => {
  let finish;
  const store = createSessionStore(() => new Promise((resolve) => { finish = resolve; }));
  const pending = store.initialize();
  await Promise.resolve();
  store.updateUser(null);
  finish(user);
  await pending;
  assert.deepEqual(store.getSnapshot(), { status: 'anonymous', user: null });
});

test('publishes account updates without making another session request', async () => {
  const store = createSessionStore(async () => ({ ...user, username: null }));
  await store.initialize();
  store.updateUser(user);
  assert.equal(store.getSnapshot().user.username, 'user');
  store.updateUser(null);
  assert.equal(store.getSnapshot().status, 'anonymous');
});

test('finishes loading for anonymous visitors and unavailable session endpoints', async () => {
  for (const load of [async () => null, async () => { throw new Error('Network unavailable'); }]) {
    const store = createSessionStore(load);
    await store.initialize();
    assert.deepEqual(store.getSnapshot(), { status: 'anonymous', user: null });
  }
});
