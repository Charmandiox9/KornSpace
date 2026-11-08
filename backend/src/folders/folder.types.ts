import type { StoredFileResponse } from '../files/file.types';

export interface FolderResponse {
  description?: string | null;
  storageBytes?: number;
  permission?: 'OWNER' | 'READER' | 'EDITOR';
  id: string;
  name: string;
  ownerId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FolderContentsResponse {
  folder: FolderResponse | null;
  breadcrumbs: FolderResponse[];
  folders: FolderResponse[];
  files: StoredFileResponse[];
}
