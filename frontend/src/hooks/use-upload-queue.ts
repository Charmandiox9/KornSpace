'use client';

import type { CancellationResult, ProgressListener, UploadQueueControls, UploadConflict } from '@/types';

import { useEffect, useRef, useState } from 'react';
import { authenticatedFetch, authenticatedRequest } from '@/lib/api-client';
import { createUploadTransport } from '@/lib/upload-request';
import { isStoredFile } from '@/features/files/is-stored-file';
import { createUploadQueue } from '@/features/files/upload-queue';

class UploadCollision extends Error {
  constructor(readonly conflictId: string) { super('File name collision'); }
}

async function collisionId(response: Response): Promise<string> {
  const payload: unknown = await response.json();
  if (typeof payload !== 'object' || payload === null || !('conflictId' in payload) || typeof payload.conflictId !== 'string') throw new Error('Invalid collision');
  return payload.conflictId;
}

async function uploadFile(file: File, signal: AbortSignal, onProgress: ProgressListener, operationId: string, folderId: string | null, replaceFileId?: string): Promise<'uploaded' | 'processing'> {
  const query = new URLSearchParams({ name: file.name });
  if (folderId) query.set('folderId', folderId);
  const response = await authenticatedRequest(`/api/files?${query.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Upload-Id': operationId, ...(replaceFileId ? { 'X-Replace-File-Id': replaceFileId } : {}) },
    body: file,
    signal,
  }, createUploadTransport(onProgress));
  if (response.status === 409) throw new UploadCollision(await collisionId(response));
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
  const [conflicts, setConflicts] = useState<UploadConflict[]>([]);
  const serverAttempts = useRef(new Map<string, string>());
  const decisions = useRef(new Map<string, (replace: boolean) => void>());
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => { onUploadedRef.current = onUploaded; }, [onUploaded]);
  const [queue] = useState(() => createUploadQueue({
    upload: async (file, signal, progress, operationId, folderId) => {
      const confirm = (conflictId: string) => new Promise<boolean>((resolve) => {
        const finish = (choice: boolean) => {
          signal.removeEventListener('abort', abort);
          decisions.current.delete(operationId);
          setConflicts((items) => items.filter((item) => item.operationId !== operationId));
          resolve(choice);
        };
        const abort = () => finish(false);
        decisions.current.set(operationId, finish);
        setConflicts((items) => [...items, { operationId, name: file.name, conflictId }]);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      });
      const response = await authenticatedFetch('/api/files/name-conflict', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, folderId }) });
      let replaceId: string | undefined;
      if (response.status === 409) {
        replaceId = await collisionId(response);
        if (!await confirm(replaceId)) return 'cancelled';
      } else if (!response.ok) throw new Error('Cannot validate file name');
      let serverOperationId = operationId;
      while (true) {
        signal.throwIfAborted();
        try { return await uploadFile(file, signal, progress, serverOperationId, folderId, replaceId); }
        catch (error: unknown) {
          if (!(error instanceof UploadCollision)) throw error;
          replaceId = error.conflictId;
          if (!await confirm(replaceId)) return 'cancelled';
          // The server has already closed the conflicting attempt. A retry always uses a new identifier.
          serverOperationId = crypto.randomUUID();
          serverAttempts.current.set(operationId, serverOperationId);
          progress({ loadedBytes: 0, totalBytes: file.size });
        }
      }
    },
    cancelUpload: (operationId) => cancelUpload(serverAttempts.current.get(operationId) ?? operationId),
    onUploaded: () => onUploadedRef.current(),
  }));

  useEffect(() => {
    queue.cancel();
    return () => queue.cancel();
  }, [queue, userId]);

  return {
    conflict: conflicts[0] ?? null,
    resolveConflict: (replace) => { const first = conflicts[0]; if (first) decisions.current.get(first.operationId)?.(replace); },
    queue,
    enqueue: (files: File[], folderId?: string | null) => { if (userId) queue.enqueue(files, folderId); },
    cancelItem: queue.cancelItem,
    retryItem: queue.retryItem,
  };
}
