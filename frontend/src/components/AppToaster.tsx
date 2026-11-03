'use client';

import { Toaster } from 'sileo';
import { useEffect, useRef } from 'react';
import { useDocumentPreferences } from '@/hooks/use-document-preferences';
import { translations } from '@/i18n';

export function AppToaster() {
  const { language, theme } = useDocumentPreferences();
  const hostRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;
    const followLatest = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewport = host.querySelector<HTMLElement>('[data-sileo-viewport]');
        if (!viewport || viewport.matches(':hover') || viewport.contains(document.activeElement)) return;
        viewport.scrollTop = viewport.scrollHeight;
      });
    };
    const resize = new ResizeObserver(followLatest);
    const tracked = new Set<Element>();
    const trackCards = () => {
      host.querySelectorAll('[data-sileo-toast]').forEach((card) => {
        if (!tracked.has(card)) { tracked.add(card); resize.observe(card); }
      });
      tracked.forEach((card) => { if (!host.contains(card)) { resize.unobserve(card); tracked.delete(card); } });
    };
    const observer = new MutationObserver(trackCards);
    observer.observe(host, { childList: true, subtree: true });
    trackCards();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); };
  }, []);
  return (
    <aside
      ref={hostRef}
      aria-label={translations[language].uploadNotifications}
      data-upload-toaster
      className={[
        '[--sileo-width:min(350px,calc(100vw_-_64px))]',
        '[&_[data-sileo-viewport]]:z-70 [&_[data-sileo-viewport]]:max-h-[calc(100svh-32px)]',
        '[&_[data-sileo-viewport]]:touch-pan-y [&_[data-sileo-viewport]]:overflow-x-hidden [&_[data-sileo-viewport]]:overflow-y-auto',
        '[&_[data-sileo-viewport]]:overscroll-contain [&_[data-sileo-viewport]]:[scrollbar-width:thin]',
        '[&_[data-sileo-toast]]:shrink-0 [&_[data-sileo-toast]]:touch-pan-y!',
        '[&_[data-sileo-canvas]]:drop-shadow-lg',
        'motion-reduce:[&_[data-sileo-viewport]_*]:animate-none!',
        'motion-reduce:[&_[data-sileo-viewport]_*]:transition-none!',
        'motion-reduce:[&_[data-sileo-viewport]_*]:duration-0!',
      ].join(' ')}
    >
      <Toaster
        position="bottom-right"
        offset={12}
        theme={theme}
        expandAll
        options={{
          fill: 'var(--surface-raised)',
          roundness: 16,
          autopilot: { expand: 0, collapse: 0 },
          styles: { title: 'normal-case! text-ink! font-semibold!', description: 'text-ink!' },
        }}
      />
    </aside>
  );
}
