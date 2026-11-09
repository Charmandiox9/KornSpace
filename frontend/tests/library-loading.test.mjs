import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readLibraryQuery } from '../.test-dist/features/files/is-folder-contents.js';
const file = { id: 'f', name: 'a.txt', contentType: 'text/plain', sizeBytes: 1, checksum: null, status: 'AVAILABLE', createdAt: '2026-01-01', openedAt: '2026-01-02' };
test('library never publishes files before folders or a partially failed GraphQL result', () => {
  assert.equal(readLibraryQuery({ data: { all: [file] } }), null);
  assert.equal(readLibraryQuery({ errors: [{ message: 'denied' }], data: { all: [file], folderContents: { folders: [] } } }), null);
  assert.deepEqual(readLibraryQuery({ data: { all: [file], folderContents: { folders: [] } } }), { all: [file], recent: [file], folders: [] });
});
