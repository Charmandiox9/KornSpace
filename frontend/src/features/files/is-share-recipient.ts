import type { ShareRecipient } from '@/types';

export function isShareRecipient(value: unknown): value is ShareRecipient {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.userId === 'string' && typeof record.email === 'string'
    && (typeof record.username === 'string' || record.username === null)
    && (typeof record.name === 'string' || record.name === null);
}
