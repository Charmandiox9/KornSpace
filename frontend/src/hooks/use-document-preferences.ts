'use client';

import { useSyncExternalStore } from 'react';
import type { DocumentPreferences } from '@/types';

function subscribe(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'data-theme'] });
  return () => observer.disconnect();
}

function getSnapshot(): string {
  const root = document.documentElement;
  return `${root.lang === 'en' ? 'en' : 'es'}:${root.dataset.theme === 'dark' ? 'dark' : 'light'}`;
}

export function useDocumentPreferences(): DocumentPreferences {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => 'es:light');
  return {
    language: snapshot.startsWith('en:') ? 'en' : 'es',
    theme: snapshot.endsWith(':dark') ? 'dark' : 'light',
  };
}
