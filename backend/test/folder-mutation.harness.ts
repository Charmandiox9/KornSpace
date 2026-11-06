import type { Folder } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { FoldersService } from '../src/folders/folders.service';

export const folderId = '11111111-1111-4111-8111-111111111111';
export const editorId = '22222222-2222-4222-8222-222222222222';
export function folderMutationHarness() {
  const folders: Folder[] = [{ id: folderId, ownerId: 'owner', parentId: null, name: 'Original', createdAt: new Date(), updatedAt: new Date() }];
  const files: Array<{ folderId: string; deletedAt: Date | null }> = [];
  const editors = new Set<string>();
  let deleteError: string | null = null;
  const tx = {
    folder: {
      findMany: async ({ where }: { where: { ownerId: string; parentId: string | null } }) => folders.filter((folder) => folder.ownerId === where.ownerId && folder.parentId === where.parentId),
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
    storedFile: { findMany: async () => [], findFirst: async ({ where }: { where: { folderId: string } }) => files.find((file) => file.folderId === where.folderId) ?? null },
    folderPermission: {
      findMany: async ({ where }: { where: { folderId?: string; userId?: string } }) => Array.from(editors).filter((userId) => !where.userId || where.userId === userId).map((userId) => ({ userId, folderId, folder: folders[0], user: { email: 'editor@example.test', username: 'editor' } })),
      findUnique: async ({ where }: { where: { folderId_userId: { userId: string } } }) => editors.has(where.folderId_userId.userId) ? { userId: where.folderId_userId.userId } : null,
      upsert: async ({ create }: { create: { userId: string } }) => { editors.add(create.userId); return create; },
      deleteMany: async ({ where }: { where: { userId: string } }) => { editors.delete(where.userId); return { count: 1 }; },
    },
    user: { findMany: async () => [{ id: editorId }] },
  };
  const prisma = { ...tx, $transaction: async <T>(operation: (client: typeof tx) => Promise<T>) => operation(tx) } as unknown as PrismaService;
  return { service: new FoldersService(prisma), folders, files, editors, failDelete: (code: string | null) => { deleteError = code; } };
}
