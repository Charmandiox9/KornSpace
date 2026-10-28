import { strict as assert } from 'node:assert';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { SessionCookieGuard } from '../src/auth/session-cookie.guard';
import { SessionJwtGuard } from '../src/auth/session-jwt.guard';
import { RedisService } from '../src/redis/redis.service';

test('GET /api/auth/me rejects requests without an access JWT and active session cookie', async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      SessionJwtGuard,
      SessionCookieGuard,
      { provide: AuthService, useValue: {} },
      { provide: JwtService, useValue: {} },
      { provide: RedisService, useValue: { get: async (): Promise<null> => null } },
    ],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');

  try {
    const serverAddress = app.getHttpServer().address();
    assert.ok(serverAddress && typeof serverAddress !== 'string');
    const address: AddressInfo = serverAddress;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      message: 'Inicia sesión para continuar.',
      error: 'Unauthorized',
      statusCode: 401,
    });
  } finally {
    await app.close();
  }
});
