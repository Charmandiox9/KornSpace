import type { Request, Response } from 'express';
import { accessCookieName, sessionCookieName } from './auth.constants';
import type { GoogleLoginResult } from './auth.types';

export function readCookie(request: Request, cookieName: string): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  for (const entry of cookieHeader.split(';')) {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex < 0) continue;
    const name = entry.slice(0, separatorIndex).trim();
    if (name !== cookieName) continue;
    try {
      return decodeURIComponent(entry.slice(separatorIndex + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

export function setAuthenticationCookies(response: Response, result: GoogleLoginResult): void {
  const secure = process.env.AUTH_COOKIE_SECURE === 'true';
  const secureAttribute = secure ? '; Secure' : '';
  response.appendHeader('Set-Cookie', [
    `${accessCookieName}=${encodeURIComponent(result.accessToken)}; Path=/; Max-Age=${result.accessTtlSeconds}; HttpOnly; SameSite=Lax${secureAttribute}`,
    `${sessionCookieName}=${encodeURIComponent(result.sessionId)}; Path=/; Max-Age=${result.sessionTtlSeconds}; HttpOnly; SameSite=Lax${secureAttribute}`,
  ]);
}

export function clearAuthenticationCookies(response: Response): void {
  const secure = process.env.AUTH_COOKIE_SECURE === 'true';
  const secureAttribute = secure ? '; Secure' : '';
  response.appendHeader('Set-Cookie', [
    `${accessCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureAttribute}`,
    `${sessionCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureAttribute}`,
  ]);
}
