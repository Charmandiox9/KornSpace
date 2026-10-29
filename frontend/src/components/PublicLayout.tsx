import type { ReactNode } from 'react';
import type { TranslationCatalog } from '../i18n';
import type { Language, Theme } from '../i18n';
import { AppearanceControls } from './AppearanceControls';

interface PublicLayoutProps {
  children: ReactNode;
  copy: TranslationCatalog;
  language: Language;
  theme: Theme;
  onLanguageChange: () => void;
  onThemeChange: () => void;
}

export function PublicLayout({
  children,
  copy,
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: PublicLayoutProps) {
  return (
    <div className="public-page">
      <header className="public-header">
        <a className="brand" href="/" aria-label="KornSpace">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span className="brand-name">KornSpace</span>
        </a>
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
