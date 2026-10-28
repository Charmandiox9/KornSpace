import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { createSessionKey, jwtAudience, jwtIssuer, oauthStateKeyPrefix, oauthStateTtlSeconds } from './auth.constants';
import type {
  AccessTokenPayload,
  AuthSessionContext,
  AuthSessionRecord,
  GoogleIdentity,
  GoogleLoginResult,
  OAuthStateRecord,
  PublicUserResponse,
} from './auth.types';

const defaultSessionTtlSeconds = 7 * 24 * 60 * 60;
const defaultAccessTtlSeconds = 15 * 60;

@Injectable()
export class AuthService {
  private readonly sessionTtlSeconds = this.readPositiveInteger('SESSION_TTL_SECONDS', defaultSessionTtlSeconds);
  private readonly accessTtlSeconds = this.readPositiveInteger('JWT_ACCESS_TTL_SECONDS', defaultAccessTtlSeconds);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  async createGoogleAuthorizationUrl(): Promise<string> {
    const client = this.getGoogleClient();
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const verifier = await client.generateCodeVerifierAsync();
    const stateRecord: OAuthStateRecord = {
      nonce,
      codeVerifier: verifier.codeVerifier,
      createdAt: Date.now(),
    };
    await this.redis.set(
      `${oauthStateKeyPrefix}${state}`,
      JSON.stringify(stateRecord),
      oauthStateTtlSeconds,
    );

    return client.generateAuthUrl({
      response_type: 'code',
      redirect_uri: this.getRedirectUri(),
      scope: ['openid', 'email', 'profile'],
      state,
      nonce,
      code_challenge: verifier.codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: 'select_account',
    });
  }

  async completeGoogleLogin(code: string | undefined, state: string | undefined): Promise<GoogleLoginResult> {
    if (!code || !state || state.length > 256) {
      throw new UnauthorizedException('La respuesta de Google no contiene un código y estado válidos.');
    }

    const rawState = await this.redis.getAndDelete(`${oauthStateKeyPrefix}${state}`);
    const stateRecord = this.parseOAuthState(rawState);
    if (!stateRecord) {
      throw new UnauthorizedException('El estado de autenticación expiró o ya fue utilizado.');
    }

    const client = this.getGoogleClient();
    const tokenResponse = await client.getToken({
      code,
      codeVerifier: stateRecord.codeVerifier,
      redirect_uri: this.getRedirectUri(),
    });
    const idToken = tokenResponse.tokens.id_token;
    if (!idToken) {
      throw new UnauthorizedException('Google no devolvió un token de identidad.');
    }

    const ticket = await client.verifyIdToken({ idToken, audience: this.getClientId() });
    const payload = ticket.getPayload();
    if (
      !payload
      || payload.nonce !== stateRecord.nonce
      || !payload.sub
      || !payload.email
      || payload.email_verified !== true
    ) {
      throw new UnauthorizedException('No se pudo validar la identidad de Google.');
    }

    const identity: GoogleIdentity = {
      subject: payload.sub,
      email: payload.email,
      name: payload.name ?? null,
      pictureUrl: payload.picture ?? null,
    };
    const user = await this.prisma.user.upsert({
      where: { googleSubject: identity.subject },
      create: {
        googleSubject: identity.subject,
        email: identity.email,
        name: identity.name,
        pictureUrl: identity.pictureUrl,
      },
      update: {
        email: identity.email,
        name: identity.name,
        pictureUrl: identity.pictureUrl,
      },
      select: { id: true },
    });

    const sessionId = randomBytes(32).toString('base64url');
    const jwtId = randomUUID();
    const session: AuthSessionRecord = {
      userId: user.id,
      jwtId,
      createdAt: Date.now(),
    };
    await this.redis.set(createSessionKey(sessionId), JSON.stringify(session), this.sessionTtlSeconds);
    const accessToken = await this.signAccessToken(user.id, sessionId, jwtId);

    return {
      sessionId,
      accessToken,
      sessionTtlSeconds: this.sessionTtlSeconds,
      accessTtlSeconds: this.accessTtlSeconds,
    };
  }

  async getCurrentUser(userId: string): Promise<PublicUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, pictureUrl: true },
    });
    if (!user) {
      throw new UnauthorizedException('La cuenta ya no está disponible.');
    }
    return user;
  }

  async refreshAccessToken(session: AuthSessionContext): Promise<GoogleLoginResult> {
    const accessToken = await this.signAccessToken(session.userId, session.sessionId, session.jwtId);
    return {
      sessionId: session.sessionId,
      accessToken,
      sessionTtlSeconds: this.sessionTtlSeconds,
      accessTtlSeconds: this.accessTtlSeconds,
    };
  }

  async logout(session: AuthSessionContext): Promise<void> {
    await this.redis.delete(session.sessionKey);
  }

  getFrontendOrigin(): string {
    return process.env.FRONTEND_ORIGIN ?? 'http://localhost';
  }

  private async signAccessToken(userId: string, sessionId: string, jwtId: string): Promise<string> {
    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      throw new ServiceUnavailableException('Configura JWT_SECRET con al menos 32 bytes aleatorios.');
    }
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId, jti: jwtId };
    return this.jwtService.signAsync(payload, {
      secret,
      algorithm: 'HS256',
      issuer: jwtIssuer,
      audience: jwtAudience,
      expiresIn: this.accessTtlSeconds,
    });
  }

  private getGoogleClient(): OAuth2Client {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('Configura GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET.');
    }
    return new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri: this.getRedirectUri(),
    });
  }

  private getClientId(): string {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) {
      throw new ServiceUnavailableException('Configura GOOGLE_OAUTH_CLIENT_ID.');
    }
    return clientId;
  }

  private getRedirectUri(): string {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI ?? 'http://localhost/api/auth/google/callback';
  }

  private parseOAuthState(value: string | null): OAuthStateRecord | null {
    if (!value) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const record = parsed as Record<string, unknown>;
      if (
        typeof record.nonce !== 'string'
        || typeof record.codeVerifier !== 'string'
        || typeof record.createdAt !== 'number'
      ) {
        return null;
      }
      return {
        nonce: record.nonce,
        codeVerifier: record.codeVerifier,
        createdAt: record.createdAt,
      };
    } catch {
      return null;
    }
  }

  private readPositiveInteger(name: string, fallback: number): number {
    const parsed = Number(process.env[name]);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
