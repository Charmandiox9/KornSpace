import type { UploadToastIconProps } from '@/types';

export function UploadToastIcon({ state }: UploadToastIconProps) {
  return (
    <svg
      className={`size-4 ${state === 'info' ? 'motion-safe:animate-spin' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-upload-check={state === 'success' ? true : undefined}
    >
      {state === 'success' ? <path d="m5 12 4 4L19 6" />
        : state === 'info' ? <path d="M20 12a8 8 0 1 1-8-8" />
          : state === 'error' ? <path d="m7 7 10 10M17 7 7 17" />
            : <path d="M12 5v9m0 4v1" />}
    </svg>
  );
}
