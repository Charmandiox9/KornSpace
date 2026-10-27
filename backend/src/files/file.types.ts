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
