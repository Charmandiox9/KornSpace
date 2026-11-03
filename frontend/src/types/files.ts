export interface StoredFile {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  status: 'PROCESSING' | 'AVAILABLE' | 'FAILED';
  checksum: string | null;
  createdAt: string;
  deletedAt?: string | null;
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
  operationId: string;
  epoch: number;
  controller: AbortController;
  cancelRequested: boolean;
  cancellation?: Promise<void>;
}

export interface UploadQueueOptions {
  upload: (file: File, signal: AbortSignal, onProgress: ProgressListener, operationId: string) => Promise<UploadResult>;
  cancelUpload: (operationId: string) => Promise<CancellationResult>;
  onUploaded: () => Promise<void>;
  concurrency?: number;
}

export interface UploadQueue {
  getSnapshot: () => UploadItem[];
  getServerSnapshot: () => UploadItem[];
  subscribe: (listener: () => void) => () => void;
  enqueue: (files: File[]) => void;
  cancel: () => void;
  cancelItem: (id: string) => void;
  retryItem: (id: string) => void;
}

export interface UploadQueueControls {
  queue: UploadQueue;
  enqueue: (files: File[]) => void;
  cancelItem: (id: string) => void;
  retryItem: (id: string) => void;
}
