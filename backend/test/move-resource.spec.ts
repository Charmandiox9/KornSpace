import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveResource } from '../src/common/move-resource';
import type { PrismaService } from '../src/prisma/prisma.service';

function fixture() {
  const folders = [{ id: '00000000-0000-4000-8000-000000000001', name: 'A', ownerId: 'owner', parentId: null as string | null }, { id: '00000000-0000-4000-8000-000000000002', name: 'B', ownerId: 'owner', parentId: '00000000-0000-4000-8000-000000000001' as string | null }];
  const file = { id: '00000000-0000-4000-8000-000000000003', name: 'report', ownerId: 'owner', folderId: '00000000-0000-4000-8000-000000000001' as string | null, deletedAt: null, deletionPending: false };
  let writes = 0, activities = 0;
  let collision = false;
  const tx = {
    folder: {
      findUnique: async ({ where }: { where: { id: string } }) => folders.find((folder) => folder.id === where.id) ?? null,
      findFirst: async () => collision ? folders[0] : null,
      update: async ({ where, data }: { where: { id: string }; data: { parentId: string | null } }) => { writes++; Object.assign(folders.find((folder) => folder.id === where.id)!, data); },
    },
    folderPermission: { findUnique: async () => ({ role: 'READER' }) },
    storedFile: {
      findFirst: async ({ where }: { where: { id?: string | object } }) => typeof where.id === 'string' ? file : collision ? file : null,
      update: async ({ data }: { data: { folderId: string | null } }) => { writes++; Object.assign(file, data); },
    },
    user: { findUnique: async () => ({ name: 'Owner', email: 'owner@example.test' }) },
    resourceActivity: { create: async () => { activities++; } },
  };
  const prisma = { $transaction: async (operation: (client: typeof tx) => Promise<void>, options: { isolationLevel: string }) => { assert.equal(options.isolationLevel, 'Serializable'); return operation(tx); } } as unknown as PrismaService;
  return { prisma, file, folders, writes: () => writes, activities: () => activities, collide: () => { collision = true; } };
}

test('same location is a no-op without metadata or activity writes', async () => {
  const f = fixture();
  await moveResource(f.prisma, 'files', '00000000-0000-4000-8000-000000000003', 'owner', '00000000-0000-4000-8000-000000000001');
  await moveResource(f.prisma, 'folders', '00000000-0000-4000-8000-000000000002', 'owner', '00000000-0000-4000-8000-000000000001');
  assert.equal(f.writes(), 0); assert.equal(f.activities(), 0);
});
test('file move changes its parent once, retaining identity and recording activity', async () => {
  const f = fixture();
  await moveResource(f.prisma, 'files', '00000000-0000-4000-8000-000000000003', 'owner', '00000000-0000-4000-8000-000000000002');
  assert.equal(f.file.folderId, '00000000-0000-4000-8000-000000000002'); assert.equal(f.file.id, '00000000-0000-4000-8000-000000000003');
  assert.equal(f.writes(), 1); assert.equal(f.activities(), 1);
});
test('folder move to root keeps its descendants linked', async () => {
  const f = fixture();
  await moveResource(f.prisma, 'folders', '00000000-0000-4000-8000-000000000002', 'owner', null);
  assert.equal(f.folders[1].parentId, null); assert.equal(f.file.folderId, '00000000-0000-4000-8000-000000000001');
});
test('self, descendant and duplicate targets fail before writing', async () => {
  const f = fixture();
  await assert.rejects(moveResource(f.prisma, 'folders', '00000000-0000-4000-8000-000000000001', 'owner', '00000000-0000-4000-8000-000000000001'));
  await assert.rejects(moveResource(f.prisma, 'folders', '00000000-0000-4000-8000-000000000001', 'owner', '00000000-0000-4000-8000-000000000002'));
  f.collide();
  await assert.rejects(moveResource(f.prisma, 'files', '00000000-0000-4000-8000-000000000003', 'owner', '00000000-0000-4000-8000-000000000002'));
  assert.equal(f.writes(), 0); assert.equal(f.activities(), 0);
});
test('reader cannot move a folder and ownership cannot change through a drop', async () => {
  const f = fixture();
  await assert.rejects(moveResource(f.prisma, 'folders', '00000000-0000-4000-8000-000000000001', 'reader', null));
  f.folders[1].ownerId = 'other';
  await assert.rejects(moveResource(f.prisma, 'files', '00000000-0000-4000-8000-000000000003', 'owner', '00000000-0000-4000-8000-000000000002'));
  assert.equal(f.writes(), 0);
});


test('REST move routes validate bodies and enforce permissions through domain services', async () => {
  const { Test } = await import('@nestjs/testing');
  const { ValidationPipe } = await import('@nestjs/common');
  const { FoldersController } = await import('../src/folders/folders.controller');
  const { FoldersService } = await import('../src/folders/folders.service');
  const { FilesController } = await import('../src/files/files.controller');
  const { FilesService } = await import('../src/files/files.service');
  const { FileLibraryService } = await import('../src/files/file-library.service');
  const { SessionJwtGuard } = await import('../src/auth/session-jwt.guard');
  const f = fixture();
  const module = await Test.createTestingModule({ controllers: [FoldersController, FilesController], providers: [
    { provide: FoldersService, useValue: new FoldersService(f.prisma) },
    { provide: FileLibraryService, useValue: new FileLibraryService(f.prisma) },
    { provide: FilesService, useValue: {} },
  ] }).overrideGuard(SessionJwtGuard).useValue({ canActivate: (context: import('@nestjs/common').ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; authContext?: { userId: string } }>();
    request.authContext = { userId: request.headers['x-user'] ?? 'owner' }; return true;
  } }).compile();
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  try {
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as import('node:net').AddressInfo;
    const post = (kind: string, id: string, body: unknown, user = 'owner') => fetch(`http://127.0.0.1:${address.port}/api/${kind}/${id}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user': user }, body: JSON.stringify(body) });
    assert.equal((await post('files', f.file.id, { destinationId: f.file.folderId })).status, 204);
    assert.equal(f.activities(), 0);
    assert.equal((await post('folders', f.folders[1].id, { destinationId: null }, 'reader')).status, 403);
    assert.equal((await post('files', f.file.id, {})).status, 400);
    assert.equal((await post('folders', f.folders[0].id, { destinationId: f.folders[1].id })).status, 400);
    assert.equal((await post('files', f.file.id, { destinationId: f.folders[1].id })).status, 204);
    assert.equal(f.file.folderId, f.folders[1].id); assert.equal(f.writes(), 1);
  } finally { await app.close(); }
});
