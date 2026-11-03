'use client';

import type { Language, Theme, UserPreferences } from '@/types';

import { useEffect, useLayoutEffect, useState } from 'react';
import {
  getInitialLanguage,
  getInitialTheme,
  getNextLanguage,
  getNextTheme,
} from '@/i18n';

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

export function usePreferences(): UserPreferences {
  const [language, setLanguage] = useState<Language>('es');
  const [theme, setTheme] = useState<Theme>('light');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setLanguage(getInitialLanguage(readPreference(languageStorageKey), navigator.language));
    setTheme(getInitialTheme(
      readPreference(themeStorageKey),
      window.matchMedia('(prefers-color-scheme: dark)').matches,
    ));
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    savePreference(languageStorageKey, language);
    savePreference(themeStorageKey, theme);
  }, [isInitialized, language, theme]);

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#111321' : '#f5f6fb');
  }, [language, theme]);

  return {
    language,
    theme,
    toggleLanguage: () => setLanguage((current) => getNextLanguage(current)),
    toggleTheme: () => setTheme((current) => getNextTheme(current)),
  };
}
