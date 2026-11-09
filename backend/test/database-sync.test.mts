import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { PrismaClient } from '@prisma/client';
import { localConnection, syncDatabases } from '../scripts/sync-local-to-neon.mts';
loadEnvFile(new URL('../../.env', import.meta.url));

const user = '10000000-0000-4000-8000-000000000001';
const peer = '10000000-0000-4000-8000-000000000002';
const parent = '20000000-0000-4000-8000-000000000099';
const child = '20000000-0000-4000-8000-000000000001';
const file = '30000000-0000-4000-8000-000000000001';
async function fixture(run: (source: PrismaClient, target: PrismaClient) => Promise<void>): Promise<void> {
  const connection = new URL(localConnection());
  assert.ok(['localhost','127.0.0.1'].includes(connection.hostname), 'Tests require PostgreSQL local');
  const admin = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
  const names = ['source','target'].map((suffix) => `kornspace_sync_test_${randomUUID().replaceAll('-','')}_${suffix}`);
  const clients: PrismaClient[] = [];
  try {
    for (const name of names) {
      assert.match(name, /^kornspace_sync_test_[a-f0-9]{32}_(source|target)$/);
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      const url = new URL(connection); url.pathname = '/' + name;
      const client = new PrismaClient({ datasources: { db: { url: url.toString() } } }); clients.push(client);
      const statements = [
        'CREATE TABLE "_prisma_migrations" (migration_name text, checksum text, finished_at timestamp, rolled_back_at timestamp)',
        `INSERT INTO "_prisma_migrations" VALUES ('test','checksum',now(),null)`,
        'CREATE TABLE "User" (id uuid PRIMARY KEY, email text NOT NULL UNIQUE)',
        'CREATE TABLE "Folder" (id uuid PRIMARY KEY, "ownerId" uuid NOT NULL REFERENCES "User"(id), "parentId" uuid REFERENCES "Folder"(id), name text NOT NULL)',
        'CREATE TABLE "StoredFile" (id uuid PRIMARY KEY, "ownerId" uuid NOT NULL REFERENCES "User"(id), "folderId" uuid REFERENCES "Folder"(id), "sizeBytes" bigint NOT NULL)',
        'CREATE TABLE "FilePermission" ("fileId" uuid REFERENCES "StoredFile"(id), "userId" uuid REFERENCES "User"(id), role text, PRIMARY KEY("fileId","userId"))',
      ];
      for (const sql of statements) await client.$executeRawUnsafe(sql);
    }
    const [source,target] = clients;
    await source.$executeRawUnsafe(`INSERT INTO "User" VALUES ($1::uuid,'original@example.test'),($2::uuid,'peer@example.test')`,user,peer);
    await source.$executeRawUnsafe(`INSERT INTO "Folder" VALUES ($1::uuid,$2::uuid,null,'Parent')`,parent,user);
    await source.$executeRawUnsafe(`INSERT INTO "Folder" VALUES ($1::uuid,$2::uuid,$3::uuid,'Child')`,child,user,parent);
    await source.$executeRawUnsafe(`INSERT INTO "StoredFile" VALUES ($1::uuid,$2::uuid,$3::uuid,9007199254740993)`,file,user,child);
    await source.$executeRawUnsafe(`INSERT INTO "FilePermission" VALUES ($1::uuid,$2::uuid,'READER')`,file,peer);
    await run(source,target);
  } finally {
    await Promise.all(clients.map((client) => client.$disconnect()));
    for (const name of names) {
      assert.match(name, /^kornspace_sync_test_[a-f0-9]{32}_(source|target)$/);
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    }
    await admin.$disconnect();
  }
}

test('dry-run is read-only; inserts preserve existing rows, bigint, hierarchy and composite keys; reruns insert nothing', { timeout: 60000 }, async () => fixture(async (source,target) => {
  await target.$executeRawUnsafe(`INSERT INTO "User" VALUES ($1::uuid,'changed@example.test')`,user);
  const preview = await syncDatabases(source,target,{ apply:false,batchSize:1 });
  assert.equal(preview.reduce((sum,row)=>sum+row.inserted,0),5);
  assert.equal((await target.$queryRawUnsafe<Array<{count:number}>>('SELECT count(*)::int AS count FROM "Folder"'))[0].count,0);
  const copied = await syncDatabases(source,target,{ apply:true,batchSize:1 });
  assert.equal(copied.reduce((sum,row)=>sum+row.inserted,0),5);
  assert.equal((await target.$queryRawUnsafe<Array<{email:string}>>('SELECT email FROM "User" WHERE id=$1::uuid',user))[0].email,'changed@example.test');
  assert.equal((await target.$queryRawUnsafe<Array<{sizeBytes:bigint}>>('SELECT "sizeBytes" FROM "StoredFile"'))[0].sizeBytes,9007199254740993n);
  const repeated = await syncDatabases(source,target,{ apply:true,batchSize:2 });
  assert.equal(repeated.reduce((sum,row)=>sum+row.inserted,0),0);
}));

test('a secondary unique collision rolls back earlier inserts', { timeout: 60000 }, async () => fixture(async (source,target) => {
  await target.$executeRawUnsafe(`INSERT INTO "User" VALUES ('10000000-0000-4000-8000-000000000009','peer@example.test')`);
  await assert.rejects(syncDatabases(source,target,{apply:true,batchSize:1}),/revirtió toda/);
  assert.equal((await target.$queryRawUnsafe<Array<{count:number}>>('SELECT count(*)::int AS count FROM "User"'))[0].count,1);
}));

test('schema and migration differences block the copy', { timeout: 60000 }, async () => fixture(async (source,target) => {
  await target.$executeRawUnsafe(`UPDATE "_prisma_migrations" SET checksum='different'`);
  await assert.rejects(syncDatabases(source,target,{apply:true,batchSize:1}),/migraciones no coinciden/);
  await target.$executeRawUnsafe(`UPDATE "_prisma_migrations" SET checksum='checksum'`);
  await target.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN unexpected text');
  await assert.rejects(syncDatabases(source,target,{apply:true,batchSize:1}),/esquemas public no coinciden/);
}));
