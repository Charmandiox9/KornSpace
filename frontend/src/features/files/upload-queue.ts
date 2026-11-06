import type { UploadJob, UploadItem, UploadQueue, UploadQueueOptions, UploadValidationError, CancellationResult } from '../../types';

export const maxUploadBytes = 100 * 1024 * 1024;

export function validateUpload(file: Pick<File, 'name' | 'size'>): UploadValidationError | null {
  if (file.size > maxUploadBytes) return 'tooLarge';
  if (file.size === 0) return 'empty';
  if (!file.name.trim() || file.name.length > 255 || /[\u0000-\u001f\u007f]/u.test(file.name)) return 'invalidName';
  return null;
}

export function createUploadQueue({ upload, cancelUpload, onUploaded, concurrency = 3 }: UploadQueueOptions): UploadQueue {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Invalid upload concurrency');
  const emptySnapshot: UploadItem[] = [];
  let snapshot = emptySnapshot;
  let epoch = 0;
  let nextId = 0;
  const pending: UploadJob[] = [];
  const active = new Map<string, UploadJob>();
  const jobs = new Map<string, UploadJob>();
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach((listener) => listener());

  function update(id: string, patch: Partial<UploadItem>): void {
    snapshot = snapshot.map((item) => item.id === id ? { ...item, ...patch } : item);
    publish();
  }

  async function settle(job: UploadJob, status: CancellationResult): Promise<void> {
    if (job.epoch !== epoch) return;
    const success = status === 'uploaded' || status === 'processing';
    update(job.id, {
      status, error: status === 'failed' ? 'requestFailed' : null,
      completionWon: success && job.cancelRequested,
      ...(success ? { loadedBytes: job.file.size } : {}),
    });
    if (success) {
      jobs.delete(job.id);
      await onUploaded().catch(() => undefined);
    }
  }

  function confirmCancellation(job: UploadJob): Promise<void> {
    return cancelUpload(job.operationId).then((status) => settle(job, status)).catch(() => {
      if (job.epoch === epoch) update(job.id, { status: 'cancelFailed' });
    });
  }

  function makeJob(id: string, file: File, folderId: string | null): UploadJob {
    return { id, file, folderId, operationId: crypto.randomUUID(), epoch, controller: new AbortController(), cancelRequested: false };
  }

  function pump(): void {
    while (active.size < concurrency && pending.length) {
      const job = pending.shift();
      if (!job) break;
      active.set(job.id, job);
      update(job.id, { status: 'uploading' });
      void (async () => {
        try {
          const result = await upload(job.file, job.controller.signal, (progress) => {
            if (job.epoch !== epoch || job.cancelRequested) return;
            const loadedBytes = Math.max(0, Math.min(progress.loadedBytes, job.file.size));
            update(job.id, { loadedBytes, status: loadedBytes === job.file.size ? 'confirming' : 'uploading' });
          }, job.operationId, job.folderId);
          if (job.cancelRequested) await job.cancellation;
          else await settle(job, result);
        } catch {
          if (job.epoch !== epoch) return;
          if (job.cancelRequested) await job.cancellation;
          else {
            // A lost response is ambiguous: reconcile before allowing a new upload attempt.
            try {
              const result = await cancelUpload(job.operationId);
              await settle(job, result === 'cancelled' ? 'failed' : result);
            } catch { update(job.id, { status: 'cancelFailed', error: 'requestFailed' }); }
          }
        } finally {
          if (job.epoch === epoch) { active.delete(job.id); pump(); }
        }
      })();
    }
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => emptySnapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    enqueue(files: File[], folderId: string | null = null): void {
      const items = files.map((file): UploadItem => {
        const id = String(++nextId);
        const error = validateUpload(file);
        if (!error) { const job = makeJob(id, file, folderId); jobs.set(id, job); pending.push(job); }
        return { id, name: file.name, sizeBytes: file.size, loadedBytes: 0, completionWon: false, status: error ? 'invalid' : 'queued', error };
      });
      snapshot = [...snapshot, ...items];
      publish();
      pump();
    },
    cancelItem(id: string): void {
      const item = snapshot.find((entry) => entry.id === id);
      const job = jobs.get(id);
      if (!job || !item || !['queued', 'uploading', 'confirming', 'cancelFailed'].includes(item.status)) return;
      const queuedIndex = pending.findIndex((entry) => entry.id === id);
      if (queuedIndex >= 0) {
        pending.splice(queuedIndex, 1);
        update(id, { status: 'cancelled' });
        return;
      }
      job.cancelRequested = true;
      update(id, { status: 'cancelling' });
      job.controller.abort();
      job.cancellation = confirmCancellation(job);
    },
    retryItem(id: string): void {
      const item = snapshot.find((entry) => entry.id === id);
      const previous = jobs.get(id);
      if (!previous || !item || !['failed', 'cancelled'].includes(item.status) || active.has(id)) return;
      const job = makeJob(id, previous.file, previous.folderId);
      jobs.set(id, job);
      pending.push(job);
      update(id, { status: 'queued', loadedBytes: 0, error: null, completionWon: false });
      pump();
    },
    cancel(): void {
      epoch += 1;
      pending.length = 0;
      active.forEach((job) => {
        job.controller.abort();
        void cancelUpload(job.operationId).catch(() => undefined);
      });
      active.clear();
      jobs.clear();
      snapshot = emptySnapshot;
      publish();
    },
  };
}
