import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PreferencesService } from '../src/preferences/preferences.service';
import { preferencesHarness } from './preferences.harness';

test('organization is personal, survives a new service instance, and does not alter resources or permissions', async () => {
  const h = preferencesHarness();
  h.folderGrants.set(h.rootId + ':peer', 'READER');
  await h.preferences.update('peer', 'files', h.fileId, { starred: true, color: 'BLUE' });
  await h.preferences.update('peer', 'folders', h.childId, { shortcut: true, color: 'VIOLET' });
  const stored = await new PreferencesService(h.prisma).list('peer');
  assert.equal(stored.length, 2);
  assert.equal(stored.find((row) => row.kind === 'files')?.file?.permission, 'READER');
  assert.equal(stored.find((row) => row.kind === 'folders')?.shortcut, true);
  assert.deepEqual(await h.preferences.list('owner'), []);
  assert.equal(h.folders[1].name, 'Child');
  assert.equal(h.files[0].ownerId, 'owner');
  await h.preferences.update('peer', 'files', h.fileId, { starred: false });
  assert.equal((await h.preferences.list('peer')).find((row) => row.kind === 'files')?.color, 'BLUE');
});

test('revoked access hides saved metadata and denies further changes without corrupting preferences', async () => {
  const h = preferencesHarness();
  await assert.rejects(h.preferences.update('stranger', 'files', h.fileId, { starred: true }), NotFoundException);
  await assert.rejects(h.preferences.update('stranger', 'folders', h.rootId, { color: 'RED' }), NotFoundException);
  assert.equal(h.rows.files.size, 0);
  h.folderGrants.set(h.rootId + ':peer', 'READER');
  await h.preferences.update('peer', 'files', h.fileId, { shortcut: true });
  await h.preferences.update('peer', 'folders', h.childId, { starred: true });
  h.folderGrants.clear();
  assert.deepEqual(await h.preferences.list('peer'), []);
  await assert.rejects(h.preferences.update('peer', 'files', h.fileId, { color: 'RED' }), NotFoundException);
  assert.equal(h.rows.files.values().next().value?.color, 'DEFAULT');
  h.fail(true);
  await assert.rejects(h.preferences.update('owner', 'files', h.fileId, { starred: true }), ServiceUnavailableException);
  assert.deepEqual(await h.preferences.list('owner'), []);
});
