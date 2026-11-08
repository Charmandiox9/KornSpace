import type { FolderContents, StoredFolder } from '@/types';
import { isStoredFile } from './is-stored-file';

function isStoredFolder(value: unknown): value is StoredFolder {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.ownerId === 'string'
    && (typeof record.parentId === 'string' || record.parentId === null)
    && typeof record.createdAt === 'string'
    && typeof record.updatedAt === 'string';
}

export function isFolderContents(value: unknown): value is FolderContents {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (record.folder === null || isStoredFolder(record.folder))
    && Array.isArray(record.breadcrumbs) && record.breadcrumbs.every(isStoredFolder)
    && Array.isArray(record.folders) && record.folders.every(isStoredFolder)
    && Array.isArray(record.files) && record.files.every(isStoredFile);
}

export function readFolderContentsQuery(value: unknown): FolderContents | null {
  if (typeof value !== 'object' || value === null) return null;
  const response = value as Record<string, unknown>;
  if (Array.isArray(response.errors) && response.errors.length > 0) return null;
  if (typeof response.data !== 'object' || response.data === null) return null;
  const data = response.data as Record<string, unknown>;
  return isFolderContents(data.folderContents) ? data.folderContents : null;
}

export { isStoredFolder };
