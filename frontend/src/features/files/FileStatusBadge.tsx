import type { FileStatusBadgeProps } from '@/types';

export function FileStatusBadge({ status, copy }: FileStatusBadgeProps) {
  if (status === 'PROCESSING') return <span className="inline-flex items-center gap-1.5 text-xs text-muted"><span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />{copy.fileProcessing}</span>;
  if (status === 'FAILED') return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-status"><span aria-hidden="true">!</span>{copy.fileFailed}</span>;
  return <span className="text-xs text-muted">{copy.fileReady}</span>;
}
