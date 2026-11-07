import { useEffect, useRef, useState } from 'react';
import { RoosterMark } from '@/components/RoosterMark';
import type { MascotSceneHandle, MascotSceneProps } from '@/types';
export function LoginMascotScene({ copy, theme }: MascotSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<MascotSceneHandle | null>(null);
  const [ready, setReady] = useState(false);
  const options = useRef({ dark: theme === 'dark', motion: true });
  options.current = { dark: theme === 'dark', motion: true };
  useEffect(() => {
    let cancelled = false;
    void import('@/lib/mascot-scene').then(({ createMascotScene }) => {
      if (cancelled || !host.current) return;
      try { scene.current = createMascotScene(host.current, { ...options.current, onUnavailable: () => { if (!cancelled) setReady(false); } }); setReady(true); }
      catch { setReady(false); }
    }).catch(() => { if (!cancelled) setReady(false); });
    return () => { cancelled = true; scene.current?.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { scene.current?.setTheme(theme === 'dark'); }, [theme]);
  return <figure data-login-mascot className="relative m-0 flex h-[min(780px,calc(100svh-230px))] min-h-[580px] min-w-0 flex-col overflow-hidden max-[900px]:order-last max-[900px]:h-[560px] max-[900px]:min-h-0 max-[480px]:h-[440px]">
    <figcaption className="relative z-1 pt-6">
      <p className="m-0 max-w-[750px] text-[clamp(32px,4vw,58px)] font-semibold leading-[1.06] tracking-[-0.035em] text-ink">{copy.mascotSceneTitle}</p>
      <p className="mt-4 text-base text-muted">{copy.mascotCaption}</p>
    </figcaption>

    <div
      ref={host}
      role="img"
      aria-label={copy.mascotDescription}
      className="relative min-h-0 w-full flex-1"
    />
    {!ready &&
      <div data-mascot-fallback className="pointer-events-none absolute inset-0 grid place-items-center pb-12">
        <span className="block size-32 text-accent">
          <RoosterMark />
        </span>
      </div>}

  </figure>;
}
