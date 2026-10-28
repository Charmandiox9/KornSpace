import { createHash } from 'node:crypto';

export const accessCookieName = 'kornspace_access';
export const sessionCookieName = 'kornspace_session';
export const oauthStateKeyPrefix = 'kornspace:oauth-state:';
export const sessionKeyPrefix = 'kornspace:session:';
export const jwtIssuer = 'kornspace-api';
export const jwtAudience = 'kornspace-web';
export const oauthStateTtlSeconds = 300;

export function createSessionKey(sessionId: string): string {
  const sessionHash = createHash('sha256').update(sessionId).digest('hex');
  return `${sessionKeyPrefix}${sessionHash}`;
}
