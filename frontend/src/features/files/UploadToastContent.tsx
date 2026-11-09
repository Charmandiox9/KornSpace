'use client';

import { useSyncExternalStore } from 'react';
import type { UploadToastContentProps } from '@/types';
import { formatFileSize } from '@/lib/format-file-size';
import { getUploadToastPresentation } from './upload-toast-presentation';
import { UploadToastIcon } from './UploadToastIcon';

export function UploadToastContent({ queue, uploadId, toastId, copy, onCancelUpload, onRetryUpload, onDismiss }: UploadToastContentProps) {
  const item = useSyncExternalStore(queue.subscribe, () => queue.getSnapshot().find((entry) => entry.id === uploadId), () => undefined);
  if (!item) return null;
  const presentation = getUploadToastPresentation(item, copy);
  const percentage = item.sizeBytes > 0 ? Math.round(item.loadedBytes * 100 / item.sizeBytes) : 0;
  const nameId = `${toastId}-name`;
  const progressId = `${toastId}-progress`;
  const dismissible = ['uploaded', 'processing', 'failed', 'cancelled', 'invalid'].includes(item.status);
  const canCancel = presentation.action === 'cancel';
  const showStatus = item.status !== 'uploading';

  return (
    <div className="grid gap-1.5 py-2.5 first:pt-0 last:pb-0" data-upload-notification data-upload-name={item.name} data-upload-state={item.status}>
      <div className="flex items-center gap-2">
        <p id={nameId} className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink" title={item.name}>{item.name}</p>
        {dismissible && (
          <button
            type="button"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink motion-reduce:transition-none"
            onClick={onDismiss}
            aria-labelledby={`${toastId}-dismiss ${nameId}`}
          >
            <span id={`${toastId}-dismiss`} className="sr-only">{copy.closeUploadNotification}</span>
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        )}
      </div>
      <p className="truncate text-[11px] text-muted" data-upload-destination>{copy.uploadDestination}: {item.destinationName}</p>
      {presentation.showProgress && (
        <div className="grid gap-1" aria-live="off">
          <div className="flex items-center gap-2">
            <div
              role="progressbar"
              aria-labelledby={`${nameId} ${progressId}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentage}
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line"
            >
              <div
                className="h-full w-full origin-left rounded-full bg-linear-to-r from-accent to-secondary transition-transform duration-150 ease-linear motion-reduce:transition-none"
                style={{ transform: `scaleX(${Math.min(1, Math.max(0, item.sizeBytes > 0 ? item.loadedBytes / item.sizeBytes : 0))})` }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted">{percentage}%</span>
            {canCancel && (
              <button
                type="button"
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink motion-reduce:transition-none"
                onClick={() => onCancelUpload(item.id)}
                aria-labelledby={`${toastId}-cancel ${nameId}`}
                title={copy.cancelUpload}
              >
                <span id={`${toastId}-cancel`} className="sr-only">{copy.cancelUpload}</span>
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            )}
          </div>
          <p id={progressId} className="text-[11px] tabular-nums text-muted">{copy.uploadProgress}: {formatFileSize(item.loadedBytes)} / {formatFileSize(item.sizeBytes)}</p>
        </div>
      )}
      {showStatus && <div className="flex items-start gap-2">
        <span className="mt-0.5 size-4 shrink-0" style={{ color: presentation.type === 'success' ? '#16a34a' : 'var(--muted)' }}><UploadToastIcon state={presentation.type} /></span>
        <div role="status" className="min-w-0 text-xs leading-relaxed">
          <p className="font-semibold text-ink">{presentation.title}</p>
          <p className="text-muted">{presentation.message}</p>
        </div>
      </div>}
      {presentation.action && !canCancel && (
        <div className="flex items-center gap-2">
            <button
              type="button"
              className="min-h-10 cursor-pointer rounded-xl border border-accent-line bg-accent-soft px-3 text-xs font-semibold text-accent transition-colors hover:bg-accent/15 motion-reduce:transition-none"
              onClick={() => presentation.action === 'retry' ? onRetryUpload(item.id) : onCancelUpload(item.id)}
              aria-labelledby={`${toastId}-action ${nameId}`}
            >
              <span id={`${toastId}-action`}>{presentation.action === 'retry' ? copy.retryUpload : presentation.action === 'check' ? copy.uploadCheckCancellation : copy.cancelUpload}</span>
            </button>
        </div>
      )}
    </div>
  );
}
