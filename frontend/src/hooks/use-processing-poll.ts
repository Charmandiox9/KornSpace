import { useEffect, useRef } from 'react';
import type { StoredFile } from '@/types';

const POLL_INTERVAL_MS = 3000;

/** Re-queries file state only while some file is PROCESSING; the timer is cleared on unmount. */
export function useProcessingPoll(files: StoredFile[], refresh: () => Promise<void> | void): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const hasProcessing = files.some((file) => file.status === 'PROCESSING' && !file.deletedAt);
  useEffect(() => {
    if (!hasProcessing) return undefined;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshRef.current();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasProcessing]);
}
