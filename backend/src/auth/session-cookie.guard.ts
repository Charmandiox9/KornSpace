import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { createSessionKey, sessionCookieName } from './auth.constants';
import { readCookie } from './auth-cookie.util';
import type { AuthenticatedRequest } from './auth-request.types';
import type { AuthSessionRecord } from './auth.types';

@Injectable()
export class SessionCookieGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionId = readCookie(request, sessionCookieName);
    if (!sessionId) {
      throw new UnauthorizedException('La sesión expiró. Inicia sesión nuevamente.');
    }

    const sessionKey = createSessionKey(sessionId);
    const rawSession = await this.redisService.get(sessionKey);
    const session = this.parseSession(rawSession);
    if (!session) {
      throw new UnauthorizedException('La sesión expiró. Inicia sesión nuevamente.');
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
