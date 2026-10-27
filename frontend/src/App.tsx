import { useLayoutEffect, useState, type ReactNode } from 'react';
import {
  getInitialLanguage,
  getInitialTheme,
  getNextLanguage,
  getNextTheme,
  translations,
  type Language,
  type Theme,
} from './i18n';

const languageStorageKey = 'kornspace-language';
const themeStorageKey = 'kornspace-theme';

function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The selected preference remains active for the current session.
  }
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.7 8.7 0 1 0 20.2 15.1Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3.7" />
      <path d="M12 2v2.1m0 15.8V22m10-10h-2.1M4.1 12H2m17.1-7.1-1.5 1.5M6.4 17.6l-1.5 1.5m14.2 0-1.5-1.5M6.4 6.4 4.9 4.9" />
    </svg>
  );
}

interface ActionButtonProps {
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  title: string;
}

function ActionButton({
  ariaLabel,
  children,
  onClick,
  pressed,
  title,
}: ActionButtonProps) {
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

export default function App() {
  const [language, setLanguage] = useState<Language>(() =>
    getInitialLanguage(readPreference(languageStorageKey), navigator.language),
  );
  const [theme, setTheme] = useState<Theme>(() =>
    getInitialTheme(
      readPreference(themeStorageKey),
      window.matchMedia('(prefers-color-scheme: dark)').matches,
    ),
  );
  const copy = translations[language];
  const nextLanguage = getNextLanguage(language);
  const nextTheme = getNextTheme(theme);
  const nextLanguageName = nextLanguage === 'en'
    ? copy.languageEnglish
    : copy.languageSpanish;
  const languageActionLabel = nextLanguage === 'en'
    ? copy.switchLanguageToEnglish
    : copy.switchLanguageToSpanish;

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.title = copy.pageTitle;
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', copy.description);
    savePreference(languageStorageKey, language);
  }, [copy.pageTitle, language]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#111a15' : '#f2f5f1');
    savePreference(themeStorageKey, theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label={copy.appearanceControls}>
        <a className="brand" href="/" aria-label="KornSpace">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span className="brand-name">KornSpace</span>
        </a>

        <section className="sidebar-actions" aria-label={copy.appearanceControls}>
          <p className="sidebar-section-label">{copy.appearanceControls}</p>
          <ActionButton
            ariaLabel={languageActionLabel}
            onClick={() => setLanguage(nextLanguage)}
            title={languageActionLabel}
          >
            <span className="language-code" aria-hidden="true">{nextLanguage.toUpperCase()}</span>
            <span>{nextLanguageName}</span>
          </ActionButton>
          <ActionButton
            ariaLabel={theme === 'light' ? copy.switchThemeToDark : copy.switchThemeToLight}
            onClick={() => setTheme(nextTheme)}
            pressed={theme === 'dark'}
            title={theme === 'light' ? copy.switchThemeToDark : copy.switchThemeToLight}
          >
            <span className="theme-icon">{theme === 'light' ? <MoonIcon /> : <SunIcon />}</span>
            <span>{theme === 'light' ? copy.darkTheme : copy.lightTheme}</span>
          </ActionButton>
        </section>
        <div className="sidebar-spacer" />
        <p className="sidebar-caption">KornSpace</p>
      </aside>

      <main className="page">
        <section className="welcome" aria-labelledby="welcome-title" aria-live="polite">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 id="welcome-title">{copy.headline}</h1>
          <p className="intro">{copy.description}</p>
          <p className="status">
            <span className="status-dot" aria-hidden="true" />
            {copy.status}
          </p>
        </section>
        <footer className="footer">{copy.footer}</footer>
      </main>
    </div>
  );
}
