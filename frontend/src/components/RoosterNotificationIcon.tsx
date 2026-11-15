import type { RoosterNotificationIconProps } from '@/types';

export function RoosterNotificationIcon({ state, activity }: RoosterNotificationIconProps) {
  const pose = state === 'success' ? 'celebrating'
    : state === 'error' || state === 'warning' ? 'helping'
      : activity === 'uploading' ? 'carrying' : 'waiting';
  const headLowered = pose === 'helping';

  return <svg data-rooster-notification={pose === 'carrying' ? 'uploading' : state} data-rooster-pose={pose} aria-hidden="true" viewBox="0 0 48 48" className="size-9 shrink-0 overflow-visible" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <g fill="var(--accent)">
      <path d="M16 27C8 28 3 22 4 15c4 5 8 5 12 6C10 16 9 11 12 8c1 6 5 9 9 11Z" />
      <path d="M14 28c0-8 6-14 13-14 7 0 11 5 11 12 0 10-7 15-14 15-7 0-11-5-10-13Z" />
      <g transform={headLowered ? 'translate(0 3)' : 'translate(0 0)'}>
        <path d="M23 18V9c0-2 3-3 4 0V6c0-3 4-3 4 0v2c3-3 6-1 4 2l-2 5Z" />
        <path d="M27 13c5-4 12-1 12 5v8H25V18Z" />
        <path d="m38 18 7 4-7 3Z" />
        <circle cx="34" cy="18" r="1.8" fill="var(--surface-raised)" />
      </g>
    </g>
    <g stroke="var(--accent)" strokeWidth="2.8">
      {pose === 'carrying' ? <path d="m21 39-5 5h-4m17-5 5 4h4" /> : <path d="M21 39v5h-4m12-5v5h5" />}
      {pose === 'celebrating' && <path d="m15 29-7-2-3-5m28 7 8-4 2-5" />}
    </g>
    {pose === 'carrying' ? <>
      <path d="M29 25h11v16H29Z" fill="var(--surface-raised)" stroke="var(--accent)" strokeWidth="2" />
      <path d="M33 30h4m-4 4h4" stroke="var(--accent)" strokeWidth="1.6" />
      <path d="M21 27q3 9 12 6" stroke="var(--surface-raised)" strokeWidth="3" />
    </> : pose === 'celebrating' ? <>
      <path d="M20 28q5 7 10 0" stroke="var(--surface-raised)" strokeWidth="2.5" />
      <path data-upload-check d="m35 6 3 3 6-6" stroke="currentColor" strokeWidth="3" />
    </> : pose === 'helping' ? <>
      <path d="M20 29q3 7 10 4" stroke="var(--surface-raised)" strokeWidth="2.5" />
      <path d="M40 4v5m0 4h.01" stroke="currentColor" strokeWidth="3" />
    </> : <>
      <path d="M20 28q0 8 9 5" stroke="var(--surface-raised)" strokeWidth="2.5" />
      <circle cx="38" cy="36" r="8" fill="var(--surface-raised)" stroke="currentColor" strokeWidth="2" />
      <path d="M38 31v5l3 2" stroke="currentColor" strokeWidth="2" />
    </>}
  </svg>;
}
