import type { AuthenticatedUser } from '@/types';

export function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && typeof record.email === 'string'
    && (typeof record.name === 'string' || record.name === null)
    && (typeof record.username === 'string' || record.username === null)
    && (typeof record.pictureUrl === 'string' || record.pictureUrl === null);
}
