export interface StoredFile {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  status: 'PROCESSING' | 'AVAILABLE' | 'FAILED';
  checksum: string | null;
  createdAt: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  pictureUrl: string | null;
}
