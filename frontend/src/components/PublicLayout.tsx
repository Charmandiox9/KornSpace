import { RoosterMark } from './RoosterMark';
import type { PublicLayoutProps } from '@/types';
import Link from 'next/link';
import { AppearanceControls } from './AppearanceControls';

export function PublicLayout({
  children,
  copy,
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: PublicLayoutProps) {
  return (
    <div className="grid min-h-full w-full max-w-[1040px] grid-rows-[auto_1fr] justify-items-center justify-self-center gap-[clamp(44px,9vh,92px)] pt-[clamp(8px,2vh,20px)] max-[760px]:gap-12">
      <header className="flex w-full items-center justify-between gap-5">
        <Link className="inline-flex shrink-0 items-center gap-[11px] text-ink no-underline" href="/" aria-label="KornSpace">
          <span className="grid size-[38px] place-items-center rounded-[11px] text-lg font-bold text-white shadow-md shadow-accent/25 max-[760px]:size-[42px] max-[420px]:size-[38px] bg-linear-to-br from-accent to-secondary" aria-hidden="true"><span className="size-8"><RoosterMark /></span></span>
          <span className="text-[15px] font-semibold tracking-tight max-[760px]:hidden">KornSpace</span>
        </Link>
        <AppearanceControls
          copy={copy}
          language={language}
          theme={theme}
          onLanguageChange={onLanguageChange}
          onThemeChange={onThemeChange}
        />
      </header>
      {children}
    </div>
  );
}
