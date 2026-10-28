import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { accessCookieName, createSessionKey, jwtAudience, jwtIssuer, sessionCookieName } from './auth.constants';
import { readCookie } from './auth-cookie.util';
import type { AuthenticatedRequest } from './auth-request.types';
import type { AccessTokenPayload, AuthSessionRecord } from './auth.types';

@Injectable()
export class SessionJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = readCookie(request, accessCookieName);
    const sessionId = readCookie(request, sessionCookieName);
    if (!accessToken || !sessionId) {
      throw new UnauthorizedException('Inicia sesión para continuar.');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || Buffer.byteLength(jwtSecret, 'utf8') < 32) {
      throw new UnauthorizedException('La autenticación no está configurada.');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken, {
        secret: jwtSecret,
        algorithms: ['HS256'],
        issuer: jwtIssuer,
        audience: jwtAudience,
      });
    } catch {
      throw new UnauthorizedException('El token de acceso no es válido o expiró.');
    }

    if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string' || typeof payload.sid !== 'string') {
      throw new UnauthorizedException('El token de acceso no contiene las credenciales requeridas.');
    }

    const sessionKey = createSessionKey(sessionId);
    const rawSession = await this.redisService.get(sessionKey);
    const session = this.parseSession(rawSession);
    if (!session || payload.sid !== sessionId || session.userId !== payload.sub || session.jwtId !== payload.jti) {
      throw new UnauthorizedException('La sesión fue cerrada o ya no está activa.');
    }

    request.authContext = { userId: session.userId };
    request.authSession = { ...session, sessionId, sessionKey };
    return true;
  }

  private parseSession(value: string | null): AuthSessionRecord | null {
    if (!value) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const record = parsed as Record<string, unknown>;
      if (typeof record.userId !== 'string' || typeof record.jwtId !== 'string' || typeof record.createdAt !== 'number') {
        return null;
      }
      return { userId: record.userId, jwtId: record.jwtId, createdAt: record.createdAt };
    } catch {
      return null;
    }
  }
}
