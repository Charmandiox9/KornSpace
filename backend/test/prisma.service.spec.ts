import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrismaService } from '../src/prisma/prisma.service';

test('PrismaService connects when the Nest module initializes', async () => {
  const prisma = new PrismaService();
  let connectionCount = 0;

  prisma.$connect = async () => {
    connectionCount += 1;
  };

  await prisma.onModuleInit();

  assert.equal(connectionCount, 1);
});

test('PrismaService disconnects when the Nest module shuts down', async () => {
  const prisma = new PrismaService();
  let disconnectionCount = 0;

  prisma.$disconnect = async () => {
    disconnectionCount += 1;
  };

  await prisma.onModuleDestroy();

  assert.equal(disconnectionCount, 1);
});
