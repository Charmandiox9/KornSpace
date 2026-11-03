'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PublicLayout } from '@/components/PublicLayout';
import { usePreferences } from '@/hooks/use-preferences';
import { translations } from '@/i18n';

export default function NotFound() {
  const router = useRouter();
  const { language, theme, toggleLanguage, toggleTheme } = usePreferences();
  const copy = translations[language];

  function goBack(): void {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace('/');
  }

  useEffect(() => {
    document.title = `${copy.notFoundTitle} — KornSpace`;
  }, [copy.notFoundTitle]);

  return (
    <main className="grid min-h-svh grid-rows-[1fr_auto] justify-items-center gap-8 bg-linear-to-br from-page to-raised px-5 py-8 sm:px-10">
      <PublicLayout
        copy={copy}
        language={language}
        theme={theme}
        onLanguageChange={toggleLanguage}
        onThemeChange={toggleTheme}
      >
        <section
          className="relative grid w-full max-w-[620px] justify-items-center gap-6 self-center overflow-hidden rounded-[20px] border border-line bg-surface px-6 py-12 text-center shadow-panel before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-linear-to-r before:from-accent before:to-secondary sm:px-12"
          aria-labelledby="not-found-title"
        >
          <p className="text-7xl font-bold tracking-tight text-accent" aria-hidden="true">{copy.notFoundCode}</p>
          <h1 id="not-found-title" className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {copy.notFoundTitle}
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted">{copy.notFoundDescription}</p>
          <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-linear-to-br from-accent to-secondary px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 motion-reduce:transition-none"
            >
              {copy.goBack}
            </button>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface px-6 text-sm font-semibold text-ink transition-colors hover:border-accent-line hover:bg-accent-soft motion-reduce:transition-none"
            >
              {copy.returnHome}
            </Link>
          </div>
        </section>
      </PublicLayout>
      <footer className="text-center text-[11px] text-muted">{copy.footer}</footer>
    </main>
  );
}
