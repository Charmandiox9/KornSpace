import type { ReactNode } from 'react';

export interface ActionButtonProps {
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  title: string;
}

export function ActionButton({ ariaLabel, children, onClick, pressed, title }: ActionButtonProps) {
  return (
    <button
      className="action-button"
      type="button"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

export function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.7 8.7 0 1 0 20.2 15.1Z" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3.7" />
      <path d="M12 2v2.1m0 15.8V22m10-10h-2.1M4.1 12H2m17.1-7.1-1.5 1.5M6.4 17.6l-1.5 1.5m14.2 0-1.5-1.5M6.4 6.4 4.9 4.9" />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.23c1.9-1.75 2.99-4.33 2.99-7.37Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.4l-3.23-2.52c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84v-2.6H3.07a10 10 0 0 0 0 9.04l3.34-2.6Z" />
      <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.86-2.86C16.96 2.99 14.7 2 12 2a10 10 0 0 0-8.93 5.48l3.34 2.6C7.2 7.72 9.4 5.96 12 5.96Z" />
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M10 17l5-5-5-5m5 5H3m9-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
    </svg>
  );
}
