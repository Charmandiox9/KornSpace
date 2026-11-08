import type { S3Client } from '@aws-sdk/client-s3';
import type { SQSClient } from '@aws-sdk/client-sqs';
import type { UploadPhase } from './upload-registry.service';

export type StoredFileStatus = 'PROCESSING' | 'AVAILABLE' | 'FAILED';

export interface ShareRecipient {
  userId: string;
  username: string | null;
  email: string;
  name: string | null;
}

export interface StoredFileResponse {
  description?: string | null;
  updatedAt?: string;
  permission?: 'OWNER' | 'READER' | 'EDITOR';
  ownerId?: string | null;
  ownerName?: string;
  folderId?: string | null;
  folderName?: string | null;
  openedAt?: string | null;
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  status: StoredFileStatus;
  checksum: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface ResourceActivityResponse {
  id: string;
  actorName: string;
  action: string;
  detail: string | null;
  createdAt: string;
}

export interface ProcessFileMessage {
  fileId: string;
  s3Key: string;
}

export interface UploadFileResult {
  file: StoredFileResponse;
  asynchronous: boolean;
}

export interface UploadOperationResponse {
  phase: UploadPhase;
  file: StoredFileResponse | null;
  asynchronous: boolean;
}

export interface UploadLifecycle {
  replaceFileId?: string;
  fileId?: string;
  folderId?: string | null;
  signal?: AbortSignal;
  beforeCommit?: () => Promise<void>;
}

export interface FileStorageClients {
  s3: S3Client;
  sqs: SQSClient;
}

export const FILE_STORAGE_CLIENTS = Symbol('FILE_STORAGE_CLIENTS');
