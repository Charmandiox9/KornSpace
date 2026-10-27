import { strict as assert } from 'node:assert';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthController } from '../src/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';

test('GET /api/health checks PostgreSQL and reports the API status', async () => {
  let databaseCheckCount = 0;
  const prismaStub = {
    $queryRaw: async (): Promise<unknown[]> => {
      databaseCheckCount += 1;
      return [];
    },
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      { provide: PrismaService, useValue: prismaStub },
    ],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();

  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');

  try {
    const serverAddress = app.getHttpServer().address();
    assert.ok(serverAddress && typeof serverAddress !== 'string');
    const address: AddressInfo = serverAddress;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    const payload: unknown = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      status: 'ok',
      service: 'kornspace-api',
      database: 'connected',
    });
    assert.equal(databaseCheckCount, 1);
  } finally {
    await app.close();
  }
});
