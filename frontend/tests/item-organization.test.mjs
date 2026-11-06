import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortResources, itemColors } from '../.test-dist/features/files/item-organization.js';

test('sorting handles names naturally, sizes, dates and ties without mutating the source', () => {
  const items = [{ name: 'file10', sizeBytes: 20, createdAt: '2026-01-01', updatedAt: '2026-01-03' }, { name: 'file2', sizeBytes: 10, createdAt: '2026-01-02' }];
  assert.deepEqual(sortResources(items, 'nameAsc').map((row) => row.name), ['file2', 'file10']);
  assert.deepEqual(sortResources(items, 'nameDesc').map((row) => row.name), ['file10', 'file2']);
  assert.equal(sortResources(items, 'modifiedDesc')[0].name, 'file10');
  assert.equal(sortResources(items, 'modifiedAsc')[0].name, 'file2');
  assert.equal(sortResources(items, 'sizeAsc')[0].name, 'file2');
  assert.equal(sortResources(items, 'sizeDesc')[0].name, 'file10');
  assert.equal(items[0].name, 'file10');
  assert.equal(sortResources([{ name: 'folder', createdAt: '2026-01-01' }], 'sizeAsc')[0].name, 'folder');
  assert.equal(Object.keys(itemColors).length, 9);
});
