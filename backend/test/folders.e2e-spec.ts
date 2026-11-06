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

test('application mounts folder routes and includes them in Swagger', async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({
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
  const folders: Array<{ id: string; name: string; ownerId: string; parentId: string | null; createdAt: Date; updatedAt: Date }> = [];
  let nextId = 0;
  const prisma = {
    folder: {
      findFirst: async ({ where }: { where: { id: string; ownerId: string } }) =>
        folders.find((folder) => folder.id === where.id && folder.ownerId === where.ownerId) ?? null,
      findMany: async ({ where }: { where: { ownerId: string; parentId: string | null } }) =>
        folders.filter((folder) => folder.ownerId === where.ownerId && folder.parentId === where.parentId),
      create: async ({ data }: { data: { name: string; ownerId: string; parentId: string | null } }) => {
        if (folders.some((folder) => folder.ownerId === data.ownerId && folder.parentId === data.parentId && folder.name === data.name)) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
        const now = new Date('2026-11-05T12:00:00.000Z');
        const folder = { ...data, id: `f00d0000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`, createdAt: now, updatedAt: now };
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
