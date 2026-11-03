import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSessionDestination } from '../.test-dist/features/auth/session-destination.js';

test('waits for session resolution before redirecting', () => {
  assert.equal(getSessionDestination('loading', false), null);
  assert.equal(getSessionDestination('loading', true), null);
});

test('sends anonymous visitors to login regardless of a cached username', () => {
  assert.equal(getSessionDestination('anonymous', false), '/login');
  assert.equal(getSessionDestination('anonymous', true), '/login');
});

test('requires account setup before entering the file workspace', () => {
  assert.equal(getSessionDestination('authenticated', false), '/onboarding');
  assert.equal(getSessionDestination('authenticated', true), '/files');
});
