import { useEffect, useSyncExternalStore } from 'react';
import type { MotionPreferences } from '@/types';
const eventName = 'kornspace-motion-change';
const storageKey = 'kornspace-motion';
const query = '(prefers-reduced-motion: reduce)';
function systemReduced() { return window.matchMedia(query).matches; }
function enabled() {
  try {
    const preference = localStorage.getItem(storageKey);
    return preference === 'full' || (!systemReduced() && preference !== 'reduced');
  }
  catch { return !systemReduced(); }
}
function subscribe(listener: () => void) {
  const media = window.matchMedia(query);
  window.addEventListener(eventName, listener); window.addEventListener('storage', listener); media.addEventListener('change', listener);
  return () => { window.removeEventListener(eventName, listener); window.removeEventListener('storage', listener); media.removeEventListener('change', listener); };
}
export function useMotionPreferences(): MotionPreferences {
  const active = useSyncExternalStore(subscribe, enabled, () => false);
  const reduced = useSyncExternalStore(subscribe, systemReduced, () => false);
  useEffect(() => { document.documentElement.dataset.motion = active ? 'full' : 'reduced'; }, [active]);
  return { enabled: active, systemReduced: reduced, toggle: () => {
    try { localStorage.setItem(storageKey, enabled() ? 'reduced' : 'full'); } catch { return; }
    window.dispatchEvent(new Event(eventName));
  } };
}
