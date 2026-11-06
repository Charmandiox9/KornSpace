import type { ItemColor } from '@prisma/client';
import type { StoredFileResponse } from '../files/file.types';
import type { FolderResponse } from '../folders/folder.types';
export interface ItemPreferenceInput { starred?: boolean; shortcut?: boolean; color?: ItemColor; }
export interface ItemPreferenceResponse {
  id: string;
  kind: 'files' | 'folders';
  starred: boolean;
  shortcut: boolean;
  color: ItemColor;
  file?: StoredFileResponse;
  folder?: FolderResponse;
}
