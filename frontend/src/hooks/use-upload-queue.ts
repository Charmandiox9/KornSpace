'use client';

import type { CancellationResult, ProgressListener, UploadQueueControls } from '@/types';

import { useEffect, useRef, useState } from 'react';
import { authenticatedFetch, authenticatedRequest } from '@/lib/api-client';
import { createUploadTransport } from '@/lib/upload-request';
import { isStoredFile } from '@/features/files/is-stored-file';
import { createUploadQueue } from '@/features/files/upload-queue';

async function uploadFile(file: File, signal: AbortSignal, onProgress: ProgressListener, operationId: string): Promise<'uploaded' | 'processing'> {
  const response = await authenticatedRequest(`/api/files?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Upload-Id': operationId },
    body: file,
    signal,
  }, createUploadTransport(onProgress));
  if (!response.ok) throw new Error('Upload failed');
  const payload: unknown = await response.json();
  if (typeof payload !== 'object' || payload === null || !('file' in payload) || !('asynchronous' in payload)
    || !isStoredFile(payload.file) || typeof payload.asynchronous !== 'boolean') {
    throw new Error('Invalid upload response');
  }
  return payload.asynchronous ? 'processing' : 'uploaded';
}

async function cancelUpload(operationId: string): Promise<CancellationResult> {
  const path = `/api/files/uploads/${encodeURIComponent(operationId)}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await authenticatedFetch(path, { method: attempt === 0 ? 'DELETE' : 'GET', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Cannot confirm upload cancellation');
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null || !('phase' in payload)) throw new Error('Invalid upload status');
    if (payload.phase === 'cancelled' || payload.phase === 'failed') return payload.phase;
    if (payload.phase === 'completed') {
      if (!('file' in payload) || !isStoredFile(payload.file) || !('asynchronous' in payload) || typeof payload.asynchronous !== 'boolean') {
        throw new Error('Invalid completed upload');
      }
      return payload.asynchronous ? 'processing' : 'uploaded';
    }
    if (!['uploading', 'confirming', 'cancelling', 'cleanupPending'].includes(String(payload.phase))) throw new Error('Invalid upload phase');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Upload cancellation is still pending');
}

export function useUploadQueue(onUploaded: () => Promise<void>, userId: string | undefined): UploadQueueControls {
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => { onUploadedRef.current = onUploaded; }, [onUploaded]);
  const [queue] = useState(() => createUploadQueue({
    upload: uploadFile,
    cancelUpload,
    onUploaded: () => onUploadedRef.current(),
  }));

  useEffect(() => {
    queue.cancel();
    return () => queue.cancel();
  }, [queue, userId]);

  return {
    queue,
    enqueue: (files: File[]) => { if (userId) queue.enqueue(files); },
    cancelItem: queue.cancelItem,
    retryItem: queue.retryItem,
  };
}
