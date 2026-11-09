import type { Folder, StoredFile, FileRole } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { FoldersService } from '../src/folders/folders.service';
import { FileLibraryService } from '../src/files/file-library.service';

export function inheritanceHarness() {
  const now = new Date('2026-11-06T00:00:00Z');
  const rootId = '10000000-0000-4000-8000-000000000001';
  const childId = '10000000-0000-4000-8000-000000000002';
  const fileId = '10000000-0000-4000-8000-000000000003';
  const folders: Folder[] = [{ id: rootId, ownerId: 'owner', parentId: null, name: 'Root', description: null, createdAt: now, updatedAt: now }, { id: childId, ownerId: 'owner', parentId: rootId, name: 'Child', description: null, createdAt: now, updatedAt: now }];
  const files: StoredFile[] = [{ id: fileId, name: 'plan.txt', description: null, folderId: childId, ownerId: 'owner', contentType: 'text/plain', sizeBytes: 4n, checksum: 'hash', s3Key: 'files/test', status: 'AVAILABLE', deletedAt: null, deletionPending: false, createdAt: now, updatedAt: now }];
  const folderGrants = new Map<string, FileRole>();
  const fileGrants = new Map<string, FileRole>();
  interface Where { OR?: Array<{ ownerId?: string; permissions?: { some: { userId: string } }; folderId?: { in: string[] } }>; name?: string; id?: string; ownerId?: string | { in: string[] }; parentId?: string | null | { in: string[] }; folderId?: string | null; permissions?: { some: { userId: string } }; deletedAt?: null; }
  const tx = {
    user: { findUnique: async () => ({ name: 'Owner', email: 'owner@example.test' }), findMany: async () => [] },
    resourceActivity: { create: async () => ({}), updateMany: async () => ({ count: 0 }), findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    folder: {
      findUnique: async ({ where }: { where: { id: string } }) => folders.find((folder) => folder.id === where.id) ?? null,
      findMany: async ({ where }: { where: Where }) => folders.filter((folder) => (!where.ownerId || (typeof where.ownerId === 'string' ? folder.ownerId === where.ownerId : where.ownerId.in.includes(folder.ownerId))) && (where.parentId === undefined ? true : typeof where.parentId === 'object' && where.parentId !== null ? where.parentId.in.includes(folder.parentId ?? '') : folder.parentId === where.parentId)),
      findFirst: async ({ where }: { where: Where }) => folders.find((folder) => folder.parentId === where.parentId) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { name: string } }) => { const folder = folders.find((item) => item.id === where.id)!; Object.assign(folder, data); return folder; },
      create: async ({ data }: { data: { name: string; ownerId: string; parentId: string } }) => { const folder = { ...data, description: null, id: 'created-folder', createdAt: now, updatedAt: now }; folders.push(folder); return folder; },
      delete: async () => { throw new Error('No deletion expected'); },
    },
    folderPermission: {
      findUnique: async ({ where }: { where: { folderId_userId: { folderId: string; userId: string } } }) => { const { folderId, userId } = where.folderId_userId; const role = folderGrants.get(folderId + ':' + userId); return role ? { folderId, userId, role } : null; },
      findMany: async ({ where }: { where: { folderId?: string; userId?: string } }) => Array.from(folderGrants).map(([key, role]) => { const [folderId, userId] = key.split(':'); return { folderId, userId, role, folder: folders.find((folder) => folder.id === folderId)!, user: { email: userId + '@example.test', username: userId } }; }).filter((grant) => (!where.folderId || grant.folderId === where.folderId) && (!where.userId || grant.userId === where.userId)),
    },
    storedFile: {
      update: async ({ where, data }: { where: { id: string }; data: { name: string } }) => { const file = files.find((item) => item.id === where.id)!; Object.assign(file, data); return file; },
      create: async ({ data }: { data: Omit<StoredFile, 'createdAt' | 'updatedAt' | 'deletedAt' | 'deletionPending'> }) => { const file: StoredFile = { ...data, createdAt: now, updatedAt: now, deletedAt: null, deletionPending: false }; files.push(file); return file; },
      findFirst: async ({ where }: { where: Where }) => { const found = files.find((file) => (!where.name || file.name === where.name) && (!where.id || file.id === where.id) && (!where.ownerId || file.ownerId === where.ownerId) && (where.deletedAt !== null || file.deletedAt === null) && (!where.permissions || fileGrants.has(where.permissions.some.userId)) && (!where.folderId || file.folderId === where.folderId)); return found ? { ...found, permissions: where.permissions ? [{ role: fileGrants.get(where.permissions.some.userId)! }] : [] } : null; },
      findMany: async ({ where }: { where: Where }) => files.filter((file) => (!('folderId' in where) || file.folderId === where.folderId) && (!where.OR || where.OR.some((clause) => clause.ownerId === file.ownerId || Boolean(clause.permissions && fileGrants.has(clause.permissions.some.userId)) || Boolean(clause.folderId?.in.includes(file.folderId ?? ''))))).map((file) => ({ ...file, permissions: [], owner: { name: 'Owner', email: 'owner@example.test' }, folder: { id: childId, name: 'Child' }, visits: [] })),
      groupBy: async () => files.filter((file) => file.folderId && file.deletedAt === null).map((file) => ({ folderId: file.folderId, _sum: { sizeBytes: file.sizeBytes } })),
    },
    filePermission: { findMany: async () => Array.from(fileGrants, ([userId, role]) => ({ userId, role, user: { email: userId + '@example.test', username: userId } })) },
  };
  const prisma = { ...tx, $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx) } as unknown as PrismaService;
  return { prisma, folders, files, folderGrants, fileGrants, rootId, childId, fileId, service: new FoldersService(prisma), library: new FileLibraryService(prisma) };
}
