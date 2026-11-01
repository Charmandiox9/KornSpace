import type { S3Client } from '@aws-sdk/client-s3';
import type { SQSClient } from '@aws-sdk/client-sqs';

export type StoredFileStatus = 'PROCESSING' | 'AVAILABLE' | 'FAILED';

export interface StoredFileResponse {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  status: StoredFileStatus;
  checksum: string | null;
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

export interface FileStorageClients {
  s3: S3Client;
  sqs: SQSClient;
}

export const FILE_STORAGE_CLIENTS = Symbol('FILE_STORAGE_CLIENTS');
