import type { StoredFile } from '@/types';

export function isStoredFile(value: unknown): value is StoredFile {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.contentType === 'string'
    && typeof record.sizeBytes === 'number'
    && (record.status === 'PROCESSING' || record.status === 'AVAILABLE' || record.status === 'FAILED')
    && (typeof record.checksum === 'string' || record.checksum === null)
    && typeof record.createdAt === 'string';
}
