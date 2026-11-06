import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FoldersService } from '../src/folders/folders.service';
import type { PrismaService } from '../src/prisma/prisma.service';

interface FolderRecord {
  id: string;
  name: string;
  ownerId: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function createHarness() {
  const folders: FolderRecord[] = [];
  const files: Array<Record<string, unknown>> = [];
  let nextId = 0;
  const prisma = {
    folder: {
      findFirst: async ({ where }: { where: { id: string; ownerId: string } }) =>
        folders.find((folder) => folder.id === where.id && folder.ownerId === where.ownerId) ?? null,
      findMany: async ({ where }: { where: { ownerId: string; parentId: string | null } }) =>
        folders.filter((folder) => folder.ownerId === where.ownerId && folder.parentId === where.parentId),
      create: async ({ data }: { data: Omit<FolderRecord, 'id' | 'createdAt' | 'updatedAt'> }) => {
        if (folders.some((folder) => folder.ownerId === data.ownerId && folder.parentId === data.parentId && folder.name === data.name)) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
        const now = new Date('2026-11-05T12:00:00.000Z');
        const folder = { ...data, id: `folder-${++nextId}`, createdAt: now, updatedAt: now };
        folders.push(folder);
        return folder;
      },
    },
    storedFile: {
      findMany: async ({ where }: { where: { ownerId: string; folderId: string | null; deletedAt: null } }) =>
        files.filter((file) => file.ownerId === where.ownerId && file.folderId === where.folderId && file.deletedAt === null),
    },
  } as unknown as PrismaService;
  return { service: new FoldersService(prisma), folders, files };
}

test('FoldersService creates root and nested folders and returns direct contents with breadcrumbs', async () => {
  const { service, files } = createHarness();
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
  assert.equal(childContents.folder?.id, child.id);
  assert.deepEqual(childContents.breadcrumbs.map((folder) => folder.id), [root.id]);
  assert.deepEqual(childContents.folders.map((folder) => folder.id), [grandchild.id]);
  assert.deepEqual(childContents.files.map((file) => file.name), ['plan.txt']);
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
