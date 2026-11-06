export interface StoredFile {
  updatedAt?: string;
  ownerId?: string | null;
  ownerName?: string;
  folderId?: string | null;
  folderName?: string | null;
  permission?: 'OWNER' | 'READER' | 'EDITOR';
  openedAt?: string | null;
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  status: 'PROCESSING' | 'AVAILABLE' | 'FAILED';
  checksum: string | null;
  createdAt: string;
  deletedAt?: string | null;
}

export interface ShareRecipient {
  userId: string;
  username: string | null;
  email: string;
  name: string | null;
}

export interface ResolvedShareRecipient {
  identifier: string;
  recipient: ShareRecipient;
}

export interface StoredFolder {
  id: string;
  name: string;
  ownerId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileDropOptions {
  folders: StoredFolder[];
  currentFolderId: string | null;
  enabled: boolean;
  onUpload: (files: File[], folderId: string | null) => void;
}

export interface FileDropState {
  isDragging: boolean;
  targetFolderId: string | null;
}

export interface FolderContents {
  folder: StoredFolder | null;
  breadcrumbs: StoredFolder[];
  folders: StoredFolder[];
  files: StoredFile[];
}

export interface FileStatusEvent {
  type: 'file.status';
  fileId: string;
  status: 'AVAILABLE' | 'FAILED';
}

export type UploadValidationError = 'tooLarge' | 'empty' | 'invalidName';

export type UploadStatus = 'queued' | 'uploading' | 'confirming' | 'cancelling' | 'cancelled' | 'cancelFailed' | 'uploaded' | 'processing' | 'invalid' | 'failed';

export type UploadResult = 'uploaded' | 'processing';

export type CancellationResult = UploadResult | 'cancelled' | 'failed';

export interface UploadProgress {
  loadedBytes: number;
  totalBytes: number;
}

export type ProgressListener = (progress: UploadProgress) => void;

export interface UploadItem {
  id: string;
  name: string;
  sizeBytes: number;
  loadedBytes: number;
  status: UploadStatus;
  completionWon: boolean;
  error: UploadValidationError | 'requestFailed' | null;
}

export interface UploadJob {
  id: string;
  file: File;
  folderId: string | null;
  operationId: string;
  epoch: number;
  controller: AbortController;
  cancelRequested: boolean;
  cancellation?: Promise<void>;
}

export interface UploadQueueOptions {
  upload: (file: File, signal: AbortSignal, onProgress: ProgressListener, operationId: string, folderId: string | null) => Promise<UploadResult | 'cancelled'>;
  cancelUpload: (operationId: string) => Promise<CancellationResult>;
  onUploaded: () => Promise<void>;
  concurrency?: number;
}

export interface UploadQueue {
  getSnapshot: () => UploadItem[];
  getServerSnapshot: () => UploadItem[];
  subscribe: (listener: () => void) => () => void;
  enqueue: (files: File[], folderId?: string | null) => void;
  cancel: () => void;
  cancelItem: (id: string) => void;
  retryItem: (id: string) => void;
}

export interface UploadQueueControls {
  conflict: UploadConflict | null;
  resolveConflict: (replace: boolean) => void;
  queue: UploadQueue;
  enqueue: (files: File[], folderId?: string | null) => void;
  cancelItem: (id: string) => void;
  retryItem: (id: string) => void;
}

export interface UploadConflict {
  operationId: string;
  name: string;
  conflictId: string;
}

export interface RestoreConflict { path: string; name: string; conflictId: string; }
