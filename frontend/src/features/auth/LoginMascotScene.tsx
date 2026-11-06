import { useEffect, useRef, useState } from 'react';
import { RoosterMark } from '@/components/RoosterMark';
import { useMotionPreferences } from '@/hooks/use-motion-preferences';
import type { MascotSceneHandle, MascotSceneProps } from '@/types';
export function LoginMascotScene({ copy, theme }: MascotSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<MascotSceneHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const motion = useMotionPreferences();
  const options = useRef({ dark: theme === 'dark', motion: motion.enabled && !paused });
  options.current = { dark: theme === 'dark', motion: motion.enabled && !paused };
  useEffect(() => {
    let cancelled = false;
    void import('@/lib/mascot-scene').then(({ createMascotScene }) => {
      if (cancelled || !host.current) return;
      try { scene.current = createMascotScene(host.current, { ...options.current, onUnavailable: () => { if (!cancelled) setReady(false); } }); setReady(true); }
      catch { setReady(false); }
    }).catch(() => { if (!cancelled) setReady(false); });
    return () => { cancelled = true; scene.current?.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { scene.current?.setMotion(motion.enabled && !paused); }, [motion.enabled, paused]);
  useEffect(() => { scene.current?.setTheme(theme === 'dark'); }, [theme]);
  function togglePlayback() {
    if (!motion.enabled) {
      setPaused(false);
      motion.toggle();
      return;
    }
    setPaused((value) => !value);
  }
  return <figure data-login-mascot data-motion-enter className="relative m-0 flex min-h-[480px] flex-col items-center justify-center overflow-hidden rounded-3xl bg-linear-to-br from-accent-soft via-raised to-surface p-5 max-[760px]:order-last max-[760px]:min-h-64">
    <div ref={host} role="img" aria-label={copy.mascotDescription} className="relative h-[390px] w-full max-[760px]:h-[260px]" />
    {!ready && <div data-mascot-fallback className="pointer-events-none absolute inset-0 grid place-items-center pb-12"><span className="block size-32 text-accent"><RoosterMark /></span></div>}
    <figcaption className="relative text-center"><p className="m-0 text-sm font-semibold text-ink">{copy.mascotSceneTitle}</p><p className="mt-2 text-xs text-muted">{copy.mascotCaption}</p></figcaption>
    <button type="button" disabled={!ready} aria-pressed={paused || !motion.enabled} aria-label={paused || !motion.enabled ? copy.mascotResume : copy.mascotPause} onClick={togglePlayback} className="absolute right-4 top-4 grid size-11 place-items-center rounded-full border border-line bg-surface/90 text-muted hover:text-accent disabled:opacity-40"><svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{paused || !motion.enabled ? <path d="m8 5 11 7-11 7V5Z" /> : <path d="M8 5v14M16 5v14" />}</svg></button>
  </figure>;
}
