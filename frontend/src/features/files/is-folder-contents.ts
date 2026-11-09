import type { FolderContents, StoredFolder, StoredFile, LibrarySnapshot } from '../../types/files';

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

export function readLibraryQuery(value: unknown): LibrarySnapshot | null {
  if (typeof value !== 'object' || value === null) return null;
  const response = value as Record<string, unknown>;
  if (Array.isArray(response.errors) && response.errors.length > 0) return null;
  if (typeof response.data !== 'object' || response.data === null) return null;
  const data = response.data as Record<string, unknown>;
  if (!Array.isArray(data.all) || !data.all.every(isStoredFile)) return null;
  if (typeof data.folderContents !== 'object' || data.folderContents === null) return null;
  const contents = data.folderContents as Record<string, unknown>;
  if (!Array.isArray(contents.folders) || !contents.folders.every(isStoredFolder)) return null;
  const all = data.all;
  const recent = all.filter((file) => file.openedAt).sort((a, b) => b.openedAt!.localeCompare(a.openedAt!)).slice(0, 200);
  return { all, recent, folders: contents.folders };
}
