import { strict as assert } from 'node:assert';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { HealthController } from '../src/health.controller';
import { HealthResolver } from '../src/health.resolver';
import {
  OperationLoggingInterceptor,
  type OperationLogger,
} from '../src/common/interceptors/operation-logging.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

test('GET /api/health checks PostgreSQL and reports the API status', async () => {
  let databaseCheckCount = 0;
  const logMessages: string[] = [];
  const loggerStub: OperationLogger = {
    log: (message: string) => logMessages.push(message),
    warn: (message: string) => logMessages.push(message),
  };
  const prismaStub = {
    $queryRaw: async (): Promise<unknown[]> => {
      databaseCheckCount += 1;
      return [];
    },
  };
  const moduleRef = await Test.createTestingModule({
    imports: [
      GraphQLModule.forRoot<ApolloDriverConfig>({
        driver: ApolloDriver,
        autoSchemaFile: true,
      }),
    ],
    controllers: [HealthController],
    providers: [
      HealthResolver,
      { provide: PrismaService, useValue: prismaStub },
    ],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();

  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new OperationLoggingInterceptor(loggerStub));
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
    assert.ok(logMessages.some((message) =>
      message.includes('[REST] GET /api/health outcome=success statusCode=200'),
    ));

    const graphQlResponse = await fetch(`http://127.0.0.1:${address.port}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query HealthStatus { health }' }),
    });
    const graphQlPayload: unknown = await graphQlResponse.json();

    assert.equal(graphQlResponse.status, 200);
    assert.deepEqual(graphQlPayload, { data: { health: 'ok' } });
    assert.ok(logMessages.some((message) =>
      message.includes('[GraphQL] query HealthStatus field=health outcome=success'),
    ));
  } finally {
    await app.close();
  }
});
