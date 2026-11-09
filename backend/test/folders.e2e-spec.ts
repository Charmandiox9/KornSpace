import { strict as assert } from 'node:assert';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { ValidationPipe, UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FoldersController } from '../src/folders/folders.controller';
import { FoldersService } from '../src/folders/folders.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SessionJwtGuard } from '../src/auth/session-jwt.guard';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GqlExecutionContext, GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';

test('application mounts folder routes and includes them in Swagger', async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({
      folderPermission: { findMany: async () => [], findUnique: async () => null },
    folder: { findMany: async () => [], findFirst: async () => null },
      storedFile: { findMany: async () => [] },
    })
    .overrideProvider(RedisService)
    .useValue({})
    .overrideGuard(SessionJwtGuard)
    .useValue({
      canActivate: (context: { switchToHttp: () => { getRequest: () => { authContext?: { userId: string } } } }) => {
        context.switchToHttp().getRequest().authContext = { userId: 'owner-1' };
        return true;
      },
    })
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');

  try {
    await app.init();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Folders test API').setVersion('1.0').build(),
    );
    assert.deepEqual(Object.keys(document.paths['/api/folders'] ?? {}).sort(), ['get', 'post']);

    const server = app.getHttpServer();
    const addressValue = server.address();
    if (!addressValue || typeof addressValue === 'string') {
      await app.listen(0, '127.0.0.1');
    }
    const address = app.getHttpServer().address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/folders`);
    assert.equal(response.status, 200);
  } finally {
    await app.close();
  }
});

test('folder REST endpoints authenticate, validate input, navigate nested folders, and isolate owners', async () => {
  const folders: Array<{ id: string; name: string; description: string | null; ownerId: string; parentId: string | null; createdAt: Date; updatedAt: Date }> = [];
  let nextId = 0;
  const prisma = {
    folderPermission: { findMany: async () => [], findUnique: async () => null },
    user: { findUnique: async () => ({ name: 'Owner', email: 'owner@example.test' }) },
    resourceActivity: { create: async () => ({}), findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    folder: {
      findUnique: async ({ where }: { where: { id: string } }) => folders.find((folder) => folder.id === where.id) ?? null,
      findFirst: async ({ where }: { where: { id: string; ownerId: string } }) =>
        folders.find((folder) => folder.id === where.id && folder.ownerId === where.ownerId) ?? null,
      findMany: async ({ where }: { where: { ownerId: string; parentId: string | null } }) =>
        folders.filter((folder) => folder.ownerId === where.ownerId && folder.parentId === where.parentId),
      create: async ({ data }: { data: { name: string; ownerId: string; parentId: string | null } }) => {
        if (folders.some((folder) => folder.ownerId === data.ownerId && folder.parentId === data.parentId && folder.name === data.name)) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
        const now = new Date('2026-11-05T12:00:00.000Z');
        const folder = { ...data, description: null, id: `f00d0000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`, createdAt: now, updatedAt: now };
        folders.push(folder);
        return folder;
      },
    },
    storedFile: { findMany: async () => [] },
  } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    controllers: [FoldersController],
    providers: [{ provide: FoldersService, useFactory: () => new FoldersService(prisma) }],
  }).overrideGuard(SessionJwtGuard).useValue({
    canActivate: (context: { switchToHttp: () => { getRequest: () => { headers: Record<string, string | undefined>; authContext?: { userId: string } } } }) => {
      const request = context.switchToHttp().getRequest();
      const userId = request.headers['x-test-user'];
      if (!userId) throw new UnauthorizedException();
      request.authContext = { userId };
      return true;
    },
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');

  try {
    const addressValue = app.getHttpServer().address();
    assert.ok(addressValue && typeof addressValue !== 'string');
    const address: AddressInfo = addressValue;
    const baseUrl = `http://127.0.0.1:${address.port}/api/folders`;
    assert.equal((await fetch(baseUrl)).status, 401);

    const headers = { 'content-type': 'application/json', 'x-test-user': 'owner-1' };
    const invalid = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify({ name: 'bad/name' }) });
    assert.equal(invalid.status, 400);

    const rootResponse = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify({ name: 'Projects' }) });
    assert.equal(rootResponse.status, 201);
    const root = await rootResponse.json() as { id: string; ownerId: string; parentId: string | null };
    assert.equal(root.ownerId, 'owner-1');
    assert.equal(root.parentId, null);

    const childResponse = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify({ name: 'Drafts', parentId: root.id }) });
    assert.equal(childResponse.status, 201);
    const child = await childResponse.json() as { id: string };

    const contentsResponse = await fetch(`${baseUrl}?parentId=${child.id}`, { headers });
    assert.equal(contentsResponse.status, 200);
    const contents = await contentsResponse.json() as { folder: { id: string }; breadcrumbs: Array<{ id: string }>; folders: unknown[]; files: unknown[] };
    assert.equal(contents.folder.id, child.id);
    assert.deepEqual(contents.breadcrumbs.map((folder) => folder.id), [root.id]);
    assert.deepEqual(contents.folders, []);
    assert.deepEqual(contents.files, []);

    const foreignContents = await fetch(`${baseUrl}?parentId=${root.id}`, { headers: { 'x-test-user': 'owner-2' } });
    assert.equal(foreignContents.status, 404);
    const missingContents = await fetch(`${baseUrl}?parentId=f00d0000-0000-4000-8000-999999999999`, { headers });
    assert.equal(missingContents.status, 404);
    const missingParent = await fetch(baseUrl, {
      method: 'POST', headers,
      body: JSON.stringify({ name: 'Orphan', parentId: 'f00d0000-0000-4000-8000-999999999999' }),
    });
    assert.equal(missingParent.status, 404);
    const conflict = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify({ name: 'Projects' }) });
    assert.equal(conflict.status, 409);
  } finally {
    await app.close();
  }
});


test('folder mutation REST routes validate names, permissions, nonempty deletion and retry', async () => {
  const { folderMutationHarness, folderId, editorId } = await import('./folder-mutation.harness');
  const h = folderMutationHarness();
  const moduleRef = await Test.createTestingModule({ controllers: [FoldersController], providers: [{ provide: FoldersService, useValue: h.service }] })
    .overrideGuard(SessionJwtGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => { headers: Record<string, string>; authContext?: { userId: string } } } }) => {
      const request = context.switchToHttp().getRequest();
      if (!request.headers['x-test-user']) throw new UnauthorizedException();
      request.authContext = { userId: request.headers['x-test-user'] }; return true;
    } }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  try {
    const url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/folders/${folderId}`;
    const request = (method: string, user = 'owner', body?: object, suffix = '') => fetch(url + suffix, { method, headers: { 'x-test-user': user, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal((await request('PATCH', 'stranger', { name: 'Denied' })).status, 404);
    assert.equal((await request('DELETE', 'stranger')).status, 404);
    assert.equal((await request('PATCH', 'owner', { name: 'bad/name' })).status, 400);
    assert.equal((await request('PATCH', 'owner', { name: 'Moved', parentId: folderId })).status, 400);
    assert.equal((await request('PUT', 'owner', { identifier: 'editor' }, '/editors')).status, 200);
    assert.equal((await request('GET', 'owner', undefined, '/editors')).status, 200);
    assert.equal((await request('GET', editorId, undefined, '/editors')).status, 404);
    assert.equal((await request('DELETE', editorId, undefined, `/editors/${editorId}`)).status, 404);
    assert.equal((await request('DELETE', 'owner', undefined, `/editors/${editorId}`)).status, 204);
    assert.equal((await request('PATCH', editorId, { name: 'Revoked' })).status, 404);
    await request('PUT', 'owner', { identifier: 'editor' }, '/editors');
    assert.equal((await request('PATCH', editorId, { name: 'Renamed' })).status, 200);
    assert.equal(h.folders[0].parentId, null);
    h.files.push({ folderId, deletedAt: null });
    assert.equal((await request('DELETE', editorId)).status, 409);
    h.files[0].deletedAt = new Date();
    assert.equal((await request('DELETE', editorId)).status, 409);
    h.files.length = 0;
    h.folders.push({ ...h.folders[0], id: 'child', parentId: folderId });
    assert.equal((await request('DELETE', editorId)).status, 409);
    h.folders.pop();
    h.failDelete('P1001');
    assert.equal((await request('DELETE', editorId)).status, 503);
    assert.equal(h.folders.length, 1);
    h.failDelete(null);
    assert.equal((await request('DELETE', editorId)).status, 204);
    assert.equal(h.folders.length, 0);
    assert.equal(h.editors.size, 0);
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Folders').setVersion('1').build());
    assert.ok(doc.paths['/api/folders/{id}']?.patch?.responses['409']);
    assert.ok(doc.paths['/api/folders/{id}']?.delete?.responses['409']);
  } finally { await app.close(); }
});


test('HTTP readers inherit access through folder descendants while editors can rename files and folders', async () => {
  const { inheritanceHarness } = await import('./permission-inheritance.harness');
  const { FileLibraryController } = await import('../src/files/file-library.controller');
  const { FileLibraryService } = await import('../src/files/file-library.service');
  const { FilesService } = await import('../src/files/files.service');
  const h = inheritanceHarness();
  h.folderGrants.set(h.rootId + ':peer', 'READER');
  const moduleRef = await Test.createTestingModule({ controllers: [FoldersController, FileLibraryController], providers: [{ provide: FoldersService, useValue: h.service }, { provide: FileLibraryService, useValue: h.library }, { provide: FilesService, useValue: {} }] })
    .overrideGuard(SessionJwtGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => { authContext?: { userId: string } } } }) => { context.switchToHttp().getRequest().authContext = { userId: 'peer' }; return true; } }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  try {
    const base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api`;
    const patch = (path: string) => fetch(base + path, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Edited' }) });
    const contents = await fetch(base + '/folders?parentId=' + h.childId);
    assert.equal(contents.status, 200);
    assert.equal(((await contents.json()) as { files: Array<{ permission: string }> }).files[0].permission, 'READER');
    assert.equal((await patch('/folders/' + h.childId)).status, 403);
    assert.equal((await patch('/files/' + h.fileId)).status, 403);
    h.folderGrants.set(h.rootId + ':peer', 'EDITOR');
    h.fileGrants.set('peer', 'READER');
    assert.equal((await patch('/folders/' + h.childId)).status, 200);
    assert.equal((await patch('/files/' + h.fileId)).status, 200);
    h.folderGrants.clear(); h.fileGrants.clear();
    assert.equal((await fetch(base + '/folders?parentId=' + h.childId)).status, 404);
    assert.equal((await patch('/files/' + h.fileId)).status, 404);
  } finally { await app.close(); }
});

test('GraphQL folderContents matches REST access for owners, readers, editors, and outsiders', async () => {
  const { inheritanceHarness } = await import('./permission-inheritance.harness');
  const { FoldersResolver } = await import('../src/folders/folders.resolver');
  const h = inheritanceHarness();
  h.folderGrants.set(h.rootId + ':reader', 'READER');
  h.folderGrants.set(h.rootId + ':editor', 'EDITOR');
  const moduleRef = await Test.createTestingModule({
    imports: [GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      context: ({ req }: { req: { headers: Record<string, string | undefined> } }) => ({ req }),
    })],
    providers: [FoldersResolver, { provide: FoldersService, useValue: h.service }],
  }).overrideGuard(SessionJwtGuard).useValue({
    canActivate: (context: import('@nestjs/common').ExecutionContext) => {
      const request = GqlExecutionContext.create(context).getContext<{ req: { headers: Record<string, string | undefined>; authContext?: { userId: string } } }>().req;
      const userId = request.headers['x-test-user'];
      if (!userId) throw new UnauthorizedException();
      request.authContext = { userId };
      return true;
    },
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  try {
    const address = app.getHttpServer().address() as AddressInfo;
    const endpoint = `http://127.0.0.1:${address.port}/graphql`;
    const query = `query FolderContents($parentId: ID!) {
      folderContents(parentId: $parentId) {
        folder { id name permission }
        folders { id name permission parentId }
        files { id name contentType sizeBytes status ownerId permission }
      }
    }`;
    async function request(userId: string | undefined) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(userId ? { 'x-test-user': userId } : {}) },
        body: JSON.stringify({ query, variables: { parentId: h.childId } }),
      });
      return response.json() as Promise<{ data?: { folderContents: { folder: { id: string; permission: string }; files: Array<Record<string, unknown>> } | null }; errors?: Array<{ extensions?: { code?: string } }> }>;
    }

    const owner = (await request('owner')).data!.folderContents!;
    assert.equal(owner.folder.permission, 'OWNER');
    assert.equal(owner.files[0]?.id, h.fileId);
    assert.equal('s3Key' in owner.files[0]!, false);
    assert.equal('url' in owner.files[0]!, false);
    assert.equal((await request('reader')).data!.folderContents!.files[0]?.permission, 'READER');
    assert.equal((await request('editor')).data!.folderContents!.files[0]?.permission, 'EDITOR');
    const stranger = await request('stranger');
    assert.equal(stranger.data?.folderContents ?? null, null);
    assert.ok(stranger.errors?.length);
    assert.ok((await request(undefined)).errors?.length);
  } finally {
    await app.close();
  }
});
