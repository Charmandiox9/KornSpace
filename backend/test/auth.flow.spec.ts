import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { accessCookieName, createSessionKey, oauthStateKeyPrefix, sessionCookieName } from '../src/auth/auth.constants';
import type { AuthSessionContext, OAuthStateRecord } from '../src/auth/auth.types';
import type { AuthenticatedRequest } from '../src/auth/auth-request.types';
import { SessionCookieGuard } from '../src/auth/session-cookie.guard';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { RedisService } from '../src/redis/redis.service';

interface ResponseStub {
  headers: Record<string, string[]>;
  redirectStatus: number | null;
  redirectUrl: string | null;
  statusCode: number | null;
  appendHeader(name: string, value: string | string[]): void;
  redirect(status: number, url: string): void;
  status(status: number): ResponseStub;
  send(): void;
}

function createResponseStub(): ResponseStub {
  return {
    headers: {},
    redirectStatus: null,
    redirectUrl: null,
    statusCode: null,
    appendHeader(name, value) {
      this.headers[name] = [...(this.headers[name] ?? []), ...(Array.isArray(value) ? value : [value])];
    },
    redirect(status, url) {
      this.redirectStatus = status;
      this.redirectUrl = url;
    },
    status(status) {
      this.statusCode = status;
      return this;
    },
    send() {},
  };
}

function mockOAuthClient(methods: Record<string, (...args: never[]) => unknown>): () => void {
  const originalDescriptors = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, method] of Object.entries(methods)) {
    originalDescriptors.set(name, Object.getOwnPropertyDescriptor(OAuth2Client.prototype, name));
    Object.defineProperty(OAuth2Client.prototype, name, { configurable: true, value: method });
  }
  return () => {
    for (const [name, descriptor] of originalDescriptors) {
      if (descriptor) Object.defineProperty(OAuth2Client.prototype, name, descriptor);
      else Reflect.deleteProperty(OAuth2Client.prototype, name);
    }
  };
}

function setEnvironment(values: Record<string, string | undefined>): () => void {
  const previousValues = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(values)) {
    previousValues.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  return () => {
    for (const [name, value] of previousValues) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

function createAuthHarness(state: OAuthStateRecord | null) {
  const stateKey = `${oauthStateKeyPrefix}valid-state`;
  let savedSessionKey: string | null = null;
  let refreshedSession: { key: string; ttlSeconds: number } | null = null;
  let deletedSessionKey: string | null = null;
  let upsertedUser = false;
  let stateAvailable = state !== null;
  const user = {
    id: 'user-1',
    email: 'person@example.com',
    name: 'Korn User',
    username: 'korn_user',
    pictureUrl: 'https://example.com/avatar.png',
  };
  const prismaStub = {
    user: {
      upsert: async () => {
        upsertedUser = true;
        return { id: user.id };
      },
      findUnique: async () => user,
    },
  };
  const redisStub = {
    getAndDelete: async (key: string): Promise<string | null> => {
      if (key !== stateKey || !state || !stateAvailable) return null;
      stateAvailable = false;
      return JSON.stringify(state);
    },
    set: async (key: string): Promise<void> => {
      savedSessionKey = key;
    },
    expire: async (key: string, ttlSeconds: number): Promise<boolean> => {
      refreshedSession = { key, ttlSeconds };
      return true;
    },
    delete: async (key: string): Promise<void> => {
      deletedSessionKey = key;
    },
  };
  const jwtStub = {
    signAsync: async (): Promise<string> => 'kornspace-signed-access-token',
  };
  const service = new AuthService(
    prismaStub as unknown as PrismaService,
    redisStub as unknown as RedisService,
    jwtStub as unknown as JwtService,
  );
  const controller = new AuthController(service);
  return {
    controller,
    service,
    user,
    get savedSessionKey() { return savedSessionKey; },
    get refreshedSession() { return refreshedSession; },
    get deletedSessionKey() { return deletedSessionKey; },
    get upsertedUser() { return upsertedUser; },
  };
}

const validOAuthState: OAuthStateRecord = {
  nonce: 'nonce-from-google-state',
  codeVerifier: 'pkce-code-verifier',
  createdAt: Date.now(),
};

test('Google login validates identity, returns to KornSpace, exposes the user and keeps provider tokens out of cookies', async () => {
  const restoreEnvironment = setEnvironment({
    GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
    GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost/api/auth/google/callback',
    JWT_SECRET: 'j'.repeat(40),
    JWT_ACCESS_TTL_SECONDS: '900',
    SESSION_TTL_SECONDS: '604800',
  });
  const restoreOAuthClient = mockOAuthClient({
    getToken: async () => ({ tokens: {
      id_token: 'google-id-token',
      access_token: 'google-provider-access-secret',
      refresh_token: 'google-provider-refresh-secret',
    } }),
    verifyIdToken: async () => ({
      getPayload: () => ({
        sub: 'google-subject',
        email: 'person@example.com',
        email_verified: true,
        nonce: validOAuthState.nonce,
        name: 'Korn User',
        picture: 'https://example.com/avatar.png',
      }),
    }),
  });
  const harness = createAuthHarness(validOAuthState);
  const response = createResponseStub();

  try {
    await harness.controller.completeGoogleLogin('google-auth-code', 'valid-state', undefined, response as never);

    assert.equal(response.redirectStatus, 302);
    assert.equal(response.redirectUrl, 'http://localhost');
    const cookies = response.headers['Set-Cookie'] ?? [];
    assert.equal(cookies.length, 2);
    assert.ok(cookies.every((cookie) => cookie.includes('HttpOnly')));
    assert.ok(cookies.some((cookie) => cookie.startsWith(`${accessCookieName}=kornspace-signed-access-token`)));
    assert.ok(cookies.some((cookie) => cookie.startsWith(`${sessionCookieName}=`)));
    assert.ok(!cookies.join(';').includes('google-id-token'));
    assert.ok(!cookies.join(';').includes('google-provider-access-secret'));
    assert.ok(!cookies.join(';').includes('google-provider-refresh-secret'));
    assert.equal(harness.upsertedUser, true);
    assert.ok(harness.savedSessionKey?.startsWith('kornspace:session:'));

    const visibleUser = await harness.controller.getCurrentUser({ authContext: { userId: 'user-1' } } as AuthenticatedRequest);
    assert.deepEqual(visibleUser, harness.user);

    await assert.rejects(
      harness.service.completeGoogleLogin('google-auth-code', 'valid-state'),
      UnauthorizedException,
    );
  } finally {
    restoreOAuthClient();
    restoreEnvironment();
  }
});

test('OAuth cancellation redirects back to KornSpace without creating a session', async () => {
  const controller = new AuthController({ getFrontendOrigin: () => 'http://frontend.local' } as unknown as AuthService);
  const response = createResponseStub();

  await controller.completeGoogleLogin(undefined, undefined, 'access_denied', response as never);

  assert.equal(response.redirectStatus, 302);
  assert.equal(response.redirectUrl, 'http://frontend.local/?loginError=denied');
  assert.equal(response.headers['Set-Cookie'], undefined);
});

test('invalid or reused OAuth state is rejected before contacting Google', async () => {
  const restoreEnvironment = setEnvironment({
    GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
  });
  let googleTokenExchangeCount = 0;
  const restoreOAuthClient = mockOAuthClient({
    getToken: async () => {
      googleTokenExchangeCount += 1;
      return { tokens: { id_token: 'google-id-token' } };
    },
    verifyIdToken: async () => ({ getPayload: () => null }),
  });
  const harness = createAuthHarness(null);

  try {
    await assert.rejects(
      harness.service.completeGoogleLogin('google-auth-code', 'invalid-state'),
      UnauthorizedException,
    );
    assert.equal(googleTokenExchangeCount, 0);
    assert.equal(harness.upsertedUser, false);
  } finally {
    restoreOAuthClient();
    restoreEnvironment();
  }
});

test('unverified Google identity is rejected and no account or session is created', async () => {
  const restoreEnvironment = setEnvironment({
    GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
    JWT_SECRET: 'j'.repeat(40),
  });
  const restoreOAuthClient = mockOAuthClient({
    getToken: async () => ({ tokens: { id_token: 'google-id-token' } }),
    verifyIdToken: async () => ({
      getPayload: () => ({
        sub: 'google-subject',
        email: 'person@example.com',
        email_verified: false,
        nonce: validOAuthState.nonce,
      }),
    }),
  });
  const harness = createAuthHarness(validOAuthState);

  try {
    await assert.rejects(
      harness.service.completeGoogleLogin('google-auth-code', 'valid-state'),
      UnauthorizedException,
    );
    assert.equal(harness.upsertedUser, false);
    assert.equal(harness.savedSessionKey, null);
  } finally {
    restoreOAuthClient();
    restoreEnvironment();
  }
});

test('invalid OAuth configuration redirects to KornSpace with an actionable failure code', async () => {
  const restoreEnvironment = setEnvironment({
    GOOGLE_OAUTH_CLIENT_ID: undefined,
    GOOGLE_OAUTH_CLIENT_SECRET: undefined,
  });
  const harness = createAuthHarness(validOAuthState);
  const response = createResponseStub();

  try {
    await harness.controller.completeGoogleLogin('google-auth-code', 'valid-state', undefined, response as never);
    assert.equal(response.redirectStatus, 302);
    assert.equal(response.redirectUrl, 'http://localhost/?loginError=configuration');
  } finally {
    restoreEnvironment();
  }
});

test('refresh extends an active Redis session and logout revokes it and clears both cookies', async () => {
  const restoreEnvironment = setEnvironment({
    JWT_SECRET: 'j'.repeat(40),
    JWT_ACCESS_TTL_SECONDS: '900',
    SESSION_TTL_SECONDS: '604800',
  });
  const harness = createAuthHarness(null);
  const session: AuthSessionContext = {
    userId: 'user-1',
    jwtId: 'jwt-id',
    createdAt: Date.now(),
    sessionId: 'active-session-id',
    sessionKey: createSessionKey('active-session-id'),
  };
  const request = { authSession: session } as AuthenticatedRequest;
  const refreshResponse = createResponseStub();
  const logoutResponse = createResponseStub();

  try {
    await harness.controller.refresh(request, refreshResponse as never);
    assert.deepEqual(harness.refreshedSession, { key: session.sessionKey, ttlSeconds: 604800 });
    assert.equal(refreshResponse.statusCode, 204);
    assert.ok(refreshResponse.headers['Set-Cookie']?.some((cookie) => cookie.startsWith(`${accessCookieName}=`)));
    assert.ok(refreshResponse.headers['Set-Cookie']?.some((cookie) => cookie.startsWith(`${sessionCookieName}=active-session-id`)));

    await harness.controller.logout(request, logoutResponse as never);
    assert.equal(harness.deletedSessionKey, session.sessionKey);
    assert.equal(logoutResponse.statusCode, 204);
    const clearedCookies = logoutResponse.headers['Set-Cookie'] ?? [];
    assert.equal(clearedCookies.length, 2);
    assert.ok(clearedCookies.every((cookie) => cookie.includes('Max-Age=0') && cookie.includes('HttpOnly')));
  } finally {
    restoreEnvironment();
  }
});

test('an expired or missing Redis session cannot be refreshed', async () => {
  const guard = new SessionCookieGuard({
    get: async (): Promise<null> => null,
  } as unknown as RedisService);
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { cookie: `${sessionCookieName}=expired-session` } }),
    }),
  } as never;

  await assert.rejects(guard.canActivate(context), UnauthorizedException);
});
