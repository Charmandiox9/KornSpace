import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { RedisService } from '../src/redis/redis.service';
import { SessionJwtGuard } from '../src/auth/session-jwt.guard';
import { createSessionKey, sessionCookieName, accessCookieName } from '../src/auth/auth.constants';
import type { AccessTokenPayload } from '../src/auth/auth.types';
import type { AuthenticatedRequest } from '../src/auth/auth-request.types';

function createContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

test('SessionJwtGuard accepts a valid JWT backed by an active matching Redis session', async () => {
  const sessionId = 'session-secret';
  const userId = 'user-1';
  const jwtId = 'jwt-1';
  const request: AuthenticatedRequest = {
    headers: { cookie: `${accessCookieName}=signed-token; ${sessionCookieName}=${sessionId}` },
  } as AuthenticatedRequest;
  const jwtStub = {
    verifyAsync: async (): Promise<AccessTokenPayload> => ({ sub: userId, sid: sessionId, jti: jwtId }),
  } as unknown as JwtService;
  const redisStub = {
    get: async (key: string): Promise<string | null> => key === createSessionKey(sessionId)
      ? JSON.stringify({ userId, jwtId, createdAt: 123 })
      : null,
  } as unknown as RedisService;
  process.env.JWT_SECRET = 'x'.repeat(32);
  const guard = new SessionJwtGuard(jwtStub, redisStub);

  assert.equal(await guard.canActivate(createContext(request)), true);
  assert.deepEqual(request.authContext, { userId });
  assert.equal(request.authSession?.sessionId, sessionId);
});

test('SessionJwtGuard rejects a valid JWT when its Redis session is missing', async () => {
  const request: AuthenticatedRequest = {
    headers: { cookie: `${accessCookieName}=signed-token; ${sessionCookieName}=session-secret` },
  } as AuthenticatedRequest;
  const jwtStub = {
    verifyAsync: async (): Promise<AccessTokenPayload> => ({ sub: 'user-1', sid: 'session-secret', jti: 'jwt-1' }),
  } as unknown as JwtService;
  const redisStub = { get: async (): Promise<null> => null } as unknown as RedisService;
  process.env.JWT_SECRET = 'x'.repeat(32);
  const guard = new SessionJwtGuard(jwtStub, redisStub);

  await assert.rejects(guard.canActivate(createContext(request)), UnauthorizedException);
});
