import type { Folder, FileRole } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { FoldersService } from '../src/folders/folders.service';

export const folderId = '11111111-1111-4111-8111-111111111111';
export const editorId = '22222222-2222-4222-8222-222222222222';
export function folderMutationHarness() {
  const folders: Folder[] = [{ id: folderId, ownerId: 'owner', parentId: null, name: 'Original', description: null, createdAt: new Date(), updatedAt: new Date() }];
  const files: Array<{ folderId: string; deletedAt: Date | null }> = [];
  const editors = new Map<string, FileRole>();
  let deleteError: string | null = null;
  const tx = {
    user: { findUnique: async () => ({ name: 'Owner', email: 'owner@example.test' }), findMany: async () => [{ id: editorId }] },
    resourceActivity: { create: async () => ({}), updateMany: async () => ({ count: 0 }), findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    folder: {
      findMany: async ({ where }: { where: { ownerId?: string | { in: string[] }; parentId?: string | null | { in: string[] } } }) => {
        if (typeof where.parentId !== 'object' || where.parentId === null) return folders.filter((folder) => folder.ownerId === where.ownerId && folder.parentId === where.parentId);
        const ownerFilter = where.ownerId;
        const parentFilter = where.parentId;
        return folders.filter((folder) => typeof ownerFilter !== 'string' && ownerFilter !== undefined && ownerFilter.in.includes(folder.ownerId) && parentFilter.in.includes(folder.parentId ?? '')).map(({ id, ownerId, parentId }) => ({ id, ownerId, parentId }));
      },
      findUnique: async ({ where }: { where: { id: string } }) => folders.find((folder) => folder.id === where.id) ?? null,
      findFirst: async ({ where }: { where: { parentId: string } }) => folders.find((folder) => folder.parentId === where.parentId) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { name: string } }) => {
        const folder = folders.find((item) => item.id === where.id)!;
        if (folders.some((other) => other.id !== folder.id && other.ownerId === folder.ownerId && other.parentId === folder.parentId && other.name === data.name)) throw { code: 'P2002' };
        folder.name = data.name; return folder;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        if (deleteError) throw { code: deleteError };
        const index = folders.findIndex((folder) => folder.id === where.id);
        const removed = folders.splice(index, 1)[0]; editors.clear(); return removed;
      },
    },
    storedFile: { findMany: async () => [], findFirst: async ({ where }: { where: { folderId: string } }) => files.find((file) => file.folderId === where.folderId) ?? null, groupBy: async () => [], aggregate: async () => ({ _sum: { sizeBytes: null } }) },
    folderPermission: {
      updateMany: async ({ where, data }: { where: { userId: string }; data: { role: FileRole } }) => { if (!editors.has(where.userId)) return { count: 0 }; editors.set(where.userId, data.role); return { count: 1 }; },
      findMany: async ({ where }: { where: { folderId?: string; userId?: string } }) => Array.from(editors.keys()).filter((userId) => !where.userId || where.userId === userId).map((userId) => ({ userId, role: editors.get(userId), folderId, folder: folders[0], user: { email: 'editor@example.test', username: 'editor' } })),
      findUnique: async ({ where }: { where: { folderId_userId: { userId: string } } }) => editors.has(where.folderId_userId.userId) ? { userId: where.folderId_userId.userId, role: editors.get(where.folderId_userId.userId) } : null,
      upsert: async ({ create }: { create: { userId: string; role: FileRole } }) => { editors.set(create.userId, create.role); return create; },
      deleteMany: async ({ where }: { where: { userId: string } }) => { editors.delete(where.userId); return { count: 1 }; },
    },
  };
  const prisma = { ...tx, $transaction: async <T>(operation: (client: typeof tx) => Promise<T>) => operation(tx) } as unknown as PrismaService;
  return { service: new FoldersService(prisma), folders, files, editors, failDelete: (code: string | null) => { deleteError = code; } };
}
