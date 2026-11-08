import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FoldersService } from '../src/folders/folders.service';
import type { PrismaService } from '../src/prisma/prisma.service';

interface FolderRecord {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function createHarness() {
  const folders: FolderRecord[] = [];
  const files: Array<Record<string, unknown>> = [];
  let hierarchyQueries = 0;
  let storageQueries = 0;
  let fileListQueries = 0;
  let nextId = 0;
  const prisma = {
    folderPermission: { findMany: async () => [], findUnique: async () => null },
    user: { findUnique: async () => ({ name: 'Owner', email: 'owner@example.test' }) },
    resourceActivity: { create: async () => ({}), findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    folder: {
      findUnique: async ({ where }: { where: { id: string } }) => folders.find((folder) => folder.id === where.id) ?? null,
      findFirst: async ({ where }: { where: { id: string; ownerId: string } }) =>
        folders.find((folder) => folder.id === where.id && folder.ownerId === where.ownerId) ?? null,
      findMany: async ({ where }: { where: { ownerId: string | { in: string[] }; parentId?: string | null | { in: string[] } } }) => {
        if (where.parentId !== null && typeof where.parentId === 'object') {
          hierarchyQueries += 1;
          const ownerFilter = where.ownerId;
          const parentFilter = where.parentId;
          return folders.filter((folder) => typeof ownerFilter !== 'string' && ownerFilter.in.includes(folder.ownerId) && parentFilter.in.includes(folder.parentId ?? '')).map(({ id, ownerId, parentId }) => ({ id, ownerId, parentId }));
        }
        return folders.filter((folder) => folder.ownerId === where.ownerId && folder.parentId === where.parentId);
      },
      // Storage usage performs a separate descendant query without ownerId.
      create: async ({ data }: { data: Omit<FolderRecord, 'id' | 'createdAt' | 'updatedAt'> }) => {
        if (folders.some((folder) => folder.ownerId === data.ownerId && folder.parentId === data.parentId && folder.name === data.name)) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
        const now = new Date('2026-11-05T12:00:00.000Z');
        const folder = { ...data, description: null, id: `folder-${++nextId}`, createdAt: now, updatedAt: now };
        folders.push(folder);
        return folder;
      },
    },
    storedFile: {
      findMany: async ({ where }: { where: { ownerId: string; folderId: string | null; deletedAt: null } }) => {
        fileListQueries += 1;
        return files.filter((file) => file.ownerId === where.ownerId && file.folderId === where.folderId && file.deletedAt === null).map((file) => ({ ...file, description: null, updatedAt: file.createdAt, owner: { name: 'Owner', email: 'owner@example.test' }, permissions: [], visits: [] }));
      },
      groupBy: async () => {
        storageQueries += 1;
        return files.filter((file) => file.folderId && file.deletedAt === null).map((file) => ({ folderId: file.folderId, _sum: { sizeBytes: file.sizeBytes as bigint } }));
      },
    },
  } as unknown as PrismaService;
  return { service: new FoldersService(prisma), folders, files, getFileListQueries: () => fileListQueries, getStorageQueryCounts: () => ({ hierarchyQueries, storageQueries }) };
}

test('FoldersService creates root and nested folders and returns direct contents with breadcrumbs', async () => {
  const { service, files, getStorageQueryCounts } = createHarness();
  const root = await service.create('owner-1', ' Projects ', null);
  const child = await service.create('owner-1', 'Drafts', root.id);
  const grandchild = await service.create('owner-1', 'Archive', child.id);
  files.push({
    id: 'file-1', name: 'plan.txt', contentType: 'text/plain', sizeBytes: 4n, status: 'AVAILABLE', checksum: 'abc',
    createdAt: new Date('2026-11-05T12:00:00.000Z'), deletedAt: null, ownerId: 'owner-1', folderId: child.id,
  });

  const rootContents = await service.listContents('owner-1', null);
  const childContents = await service.listContents('owner-1', child.id);
  assert.deepEqual(rootContents.folders.map((folder) => folder.name), ['Projects']);
  assert.deepEqual(rootContents.files, []);
  assert.equal(rootContents.folders[0]?.storageBytes, 4);
  assert.equal(childContents.folder?.id, child.id);
  assert.deepEqual(childContents.breadcrumbs.map((folder) => folder.id), [root.id]);
  assert.deepEqual(childContents.folders.map((folder) => folder.id), [grandchild.id]);
  assert.deepEqual(childContents.files.map((file) => file.name), ['plan.txt']);
  const queryCounts = getStorageQueryCounts();
  assert.equal(queryCounts.hierarchyQueries, 4);
  assert.equal(queryCounts.storageQueries, 2);
});

test('FoldersService isolates owners and rejects missing parents, invalid names, and duplicate sibling names', async () => {
  const { service } = createHarness();
  const ownParent = await service.create('owner-1', 'Projects', null);
  const foreignParent = await service.create('owner-2', 'Projects', null);

  await assert.rejects(service.create('owner-1', 'Private', foreignParent.id), NotFoundException);
  await assert.rejects(service.listContents('owner-1', foreignParent.id), NotFoundException);
  await assert.rejects(service.create('owner-1', 'Projects', null), ConflictException);
  await assert.rejects(service.create('owner-1', ' bad/name ', null), BadRequestException);
  await assert.rejects(service.create('owner-1', 'Lost', 'missing-folder'), NotFoundException);
  assert.equal((await service.listContents('owner-1', null)).folders[0]?.id, ownParent.id);
});

test('folder storage is fetched in a fixed number of grouped queries regardless of visible folder count', async () => {
  const { service, files, getStorageQueryCounts } = createHarness();
  const root = await service.create('owner-1', 'Root', null);
  for (let index = 0; index < 12; index += 1) await service.create('owner-1', `Folder ${index}`, root.id);
  files.push({ folderId: 'folder-2', ownerId: 'owner-1', sizeBytes: 7n, deletedAt: null });
  const result = await service.listContents('owner-1', null);
  assert.equal(result.folders.length, 1);
  const nested = await service.listContents('owner-1', root.id);
  assert.equal(nested.folders.length, 12);
  assert.ok(nested.folders.every((folder) => folder.storageBytes === 7 || folder.storageBytes === 0));
  assert.deepEqual(getStorageQueryCounts(), { hierarchyQueries: 3, storageQueries: 2 });
});


test('folder owners manage editors; outsiders and revoked editors cannot rename or delete', async () => {
  const { folderMutationHarness, folderId, editorId } = await import('./folder-mutation.harness');
  const h = folderMutationHarness();
  await assert.rejects(h.service.rename(folderId, 'stranger', 'Denied'), NotFoundException);
  await assert.rejects(h.service.remove(folderId, 'stranger'), NotFoundException);
  await assert.rejects(h.service.grantEditor(folderId, 'stranger', 'editor'), NotFoundException);
  await h.service.grantEditor(folderId, 'owner', 'editor');
  assert.equal((await h.service.listEditors(folderId, 'owner'))[0].userId, editorId);
  await assert.rejects(h.service.listEditors(folderId, editorId), NotFoundException);
  const sharedRoot = await h.service.listContents(editorId, null);
  assert.deepEqual(sharedRoot.folders.map((folder) => folder.id), [folderId]);
  const sharedFolder = await h.service.listContents(editorId, folderId);
  assert.equal(sharedFolder.folder?.id, folderId);
  assert.equal(sharedFolder.folder?.permission, 'EDITOR');
  assert.deepEqual(sharedFolder.files, []);
  assert.deepEqual(sharedFolder.folders, []);
  await h.service.rename(folderId, editorId, ' Updated ');
  assert.equal(h.folders[0].name, 'Updated');
  await assert.rejects(h.service.rename(folderId, editorId, 'bad/name'), BadRequestException);
  await h.service.revokeEditor(folderId, 'owner', editorId);
  await assert.rejects(h.service.remove(folderId, editorId), NotFoundException);
  await h.service.grantEditor(folderId, 'owner', 'editor');
  await h.service.remove(folderId, editorId);
  assert.equal(h.folders.length, 0);
  assert.equal(h.editors.size, 0);
});

test('folder deletion rejects descendants and files including trash without modifying relationships', async () => {
  const { folderMutationHarness, folderId } = await import('./folder-mutation.harness');
  const h = folderMutationHarness();
  h.files.push({ folderId, deletedAt: new Date() });
  await assert.rejects(h.service.remove(folderId, 'owner'), ConflictException);
  assert.equal(h.files.length, 1); assert.equal(h.folders.length, 1);
  h.files.length = 0;
  h.folders.push({ ...h.folders[0], id: 'child', parentId: folderId });
  await assert.rejects(h.service.remove(folderId, 'owner'), ConflictException);
  assert.equal(h.folders.length, 2);
});

test('folder mutations reject duplicate names and recover from database errors and concurrent inserts', async () => {
  const { folderMutationHarness, folderId } = await import('./folder-mutation.harness');
  const { ServiceUnavailableException } = await import('@nestjs/common');
  const h = folderMutationHarness();
  h.folders.push({ ...h.folders[0], id: 'sibling', name: 'Taken' });
  await assert.rejects(h.service.rename(folderId, 'owner', 'Taken'), ConflictException);
  assert.equal(h.folders[0].name, 'Original');
  h.failDelete('P2003');
  await assert.rejects(h.service.remove(folderId, 'owner'), ConflictException);
  h.failDelete('P1001');
  await assert.rejects(h.service.remove(folderId, 'owner'), ServiceUnavailableException);
  assert.equal(h.folders.length, 2);
  h.failDelete(null);
  await h.service.remove(folderId, 'owner');
  assert.equal(h.folders.length, 1);
});


test('folder roles inherit through descendants and future folders; strongest access wins and revocation is immediate', async () => {
  const { inheritanceHarness } = await import('./permission-inheritance.harness');
  const { fileAccess } = await import('../src/files/file-policy');
  const { ForbiddenException } = await import('@nestjs/common');
  const h = inheritanceHarness();
  h.folderGrants.set(h.rootId + ':peer', 'READER');
  assert.equal((await fileAccess(h.prisma, h.fileId, 'peer')).role, 'READER');
  const contents = await h.service.listContents('peer', h.childId);
  assert.equal(contents.files[0].id, h.fileId);
  assert.equal(contents.files[0].permission, 'READER');
  await assert.rejects(h.service.rename(h.childId, 'peer', 'Denied'), ForbiddenException);
  await assert.rejects(h.service.remove(h.childId, 'peer'), ForbiddenException);
  await assert.rejects(h.service.create('peer', 'Denied', h.childId), ForbiddenException);
  await assert.rejects(fileAccess(h.prisma, h.fileId, 'peer', true), ForbiddenException);
  h.folderGrants.set(h.rootId + ':peer', 'EDITOR');
  h.fileGrants.set('peer', 'READER');
  assert.equal((await fileAccess(h.prisma, h.fileId, 'peer', true)).role, 'EDITOR');
  assert.equal((await h.library.browse('peer', { shared: true }))[0]?.permission, 'EDITOR');
  await h.service.rename(h.childId, 'peer', 'Edited');
  const created = await h.service.create('peer', 'Future', h.childId);
  assert.equal(created.ownerId, 'owner');
  assert.equal((await h.service.listContents('peer', created.id)).folder?.permission, 'EDITOR');
  h.folderGrants.delete(h.rootId + ':peer');
  assert.equal((await fileAccess(h.prisma, h.fileId, 'peer')).role, 'READER');
  await assert.rejects(fileAccess(h.prisma, h.fileId, 'peer', true), ForbiddenException);
  h.fileGrants.clear();
  assert.deepEqual(await h.library.browse('peer'), []);
  await assert.rejects(fileAccess(h.prisma, h.fileId, 'peer'), NotFoundException);
  await assert.rejects(h.service.listContents('peer', h.childId), NotFoundException);
});

test('sharing lists direct and inherited users with their source and rejects cyclic hierarchies', async () => {
  const { inheritanceHarness } = await import('./permission-inheritance.harness');
  const { ServiceUnavailableException } = await import('@nestjs/common');
  const h = inheritanceHarness();
  h.folderGrants.set(h.rootId + ':reader', 'READER');
  h.folderGrants.set(h.childId + ':editor', 'EDITOR');
  h.fileGrants.set('direct', 'READER');
  const permissions = await h.library.listPermissions(h.fileId, 'owner');
  assert.equal(permissions.find((row) => row.userId === 'direct')?.inherited, false);
  assert.equal(permissions.find((row) => row.userId === 'reader')?.sourceId, h.rootId);
  assert.equal(permissions.find((row) => row.userId === 'editor')?.role, 'EDITOR');
  const folderPermissions = await h.service.listEditors(h.childId, 'owner');
  assert.equal(folderPermissions.find((row) => row.userId === 'reader')?.inherited, true);
  assert.equal(folderPermissions.find((row) => row.userId === 'editor')?.inherited, false);
  await assert.rejects(h.library.listPermissions(h.fileId, 'reader'), NotFoundException);
  h.folders[0].parentId = h.childId;
  await assert.rejects(h.service.listContents('reader', h.childId), ServiceUnavailableException);
});

test('owners can inspect permissions for trashed files while other users cannot', async () => {
  const { inheritanceHarness } = await import('./permission-inheritance.harness');
  const h = inheritanceHarness();
  h.files[0].deletedAt = new Date('2026-11-08T00:00:00Z');
  h.fileGrants.set('peer', 'READER');
  const permissions = await h.library.listPermissions(h.fileId, 'owner');
  assert.equal(permissions[0]?.userId, 'peer');
  await assert.rejects(h.library.listPermissions(h.fileId, 'peer'), NotFoundException);
});


test('library resolves inherited folder permissions once for files sharing a folder', async () => {
  const { inheritanceHarness } = await import('./permission-inheritance.harness');
  const h = inheritanceHarness();
  h.folderGrants.set(h.rootId + ':peer', 'READER');
  h.files.push({ ...h.files[0], id: 'second-file' });
  let calls = 0;
  const original = h.prisma.folderPermission.findUnique.bind(h.prisma.folderPermission);
  h.prisma.folderPermission.findUnique = ((...args: Parameters<typeof original>) => {
    calls += 1;
    return original(...args);
  }) as unknown as typeof original;
  const files = await h.library.browse('peer');
  assert.equal(files.length, 2);
  assert.ok(files.every((file) => file.permission === 'READER'));
  assert.equal(calls, 2);
});


test('folder-only metadata skips file listing while retaining folder authorization', async () => {
  const h = createHarness();
  await h.service.create('owner', 'Root', null);
  const result = await h.service.listContents('owner', null, false);
  assert.equal(result.folders.length, 1);
  assert.deepEqual(result.files, []);
  assert.equal(h.getFileListQueries(), 0);
  const foreign = await h.service.create('other', 'Private', null);
  await assert.rejects(h.service.listContents('owner', foreign.id, false), NotFoundException);
});
