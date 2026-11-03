'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { sileo } from 'sileo';
import type { UploadNotificationsProps, UploadToastOptions } from '@/types';
import { UploadToastContent } from './UploadToastContent';
import { UploadToastIcon } from './UploadToastIcon';

export function UploadNotifications({ queue, copy, onCancelUpload, onRetryUpload }: UploadNotificationsProps) {
  const uploads = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getServerSnapshot);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [toastId] = useState(() => `uploads-${crypto.randomUUID()}`);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const signature = useRef('');
  const membership = uploads.filter((item) => !hidden.has(item.id)).map((item) => `${item.id}:${item.status}`).join('|');

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      pendingTimers.forEach(clearTimeout);
      pendingTimers.clear();
      signature.current = '';
      sileo.dismiss(toastId);
    };
  }, [queue, toastId]);

  useEffect(() => {
    for (const item of uploads) {
      const completed = item.status === 'uploaded' || item.status === 'processing';
      if (completed && !hidden.has(item.id) && !timers.current.has(item.id)) {
        timers.current.set(item.id, setTimeout(() => {
          setHidden((previous) => new Set([...previous, item.id]));
          timers.current.delete(item.id);
        }, 7000));
      }
    }
  }, [uploads, hidden]);

  useEffect(() => {
    // Byte events update each row without restarting the toast's animation.
    const nextSignature = `${membership}|${copy.uploadsHeading}|${copy.uploadToastCompleted}`;
    if (signature.current === nextSignature) return;
    signature.current = nextSignature;
    const items = queue.getSnapshot().filter((item) => !hidden.has(item.id));
    if (!items.length) { sileo.dismiss(toastId); return; }
    const complete = items.every((item) => ['uploaded', 'processing'].includes(item.status));
    const active = items.some((item) => ['queued', 'uploading', 'confirming', 'cancelling'].includes(item.status));
    const state = complete ? 'success' : active ? 'info' : 'warning';
    const options: UploadToastOptions = {
      id: toastId,
      dismissible: false,
      title: complete ? copy.uploadToastCompleted : copy.uploadsHeading,
      type: state,
      duration: null,
      icon: <UploadToastIcon state={state} />,
      fill: 'var(--surface-raised)',
      autopilot: { expand: 0, collapse: 0 },
      description: (
        <div data-upload-group className="max-h-[min(60svh,520px)] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
          <div className="divide-y divide-line">
            {items.map((item) => (
              <UploadToastContent
                key={item.id}
                queue={queue}
                uploadId={item.id}
                toastId={`${toastId}-${item.id}`}
                copy={copy}
                onCancelUpload={onCancelUpload}
                onRetryUpload={onRetryUpload}
                onDismiss={() => setHidden((previous) => new Set([...previous, item.id]))}
              />
            ))}
          </div>
        </div>
      ),
    };
    sileo.show(options);
  }, [copy, hidden, membership, onCancelUpload, onRetryUpload, queue, toastId]);

  return null;
}
