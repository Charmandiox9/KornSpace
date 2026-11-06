import type { MascotTimeline } from '../types/mascot';

export const mascotCycleSeconds = 18;

/** The same scattered pose closes one cycle and opens the next, without a jump. */
export function getMascotTimeline(elapsed: number): MascotTimeline {
  const time = Math.max(0, elapsed);
  const cycle = Math.floor(time / mascotCycleSeconds);
  const position = time % mascotCycleSeconds;
  const smooth = (value: number) => { const t = Math.min(1, Math.max(0, value)); return t * t * (3 - 2 * t); };
  const base = { cycle, dispersion: 0, action: Math.min(1, Math.max(0, (position - 2.4) / 12.6)), doorOpen: 0, travel: 0 };
  if (position < 2.4) return { ...base, phase: 'assembling', dispersion: Math.pow(1 - position / 2.4, 3) };
  if (position < 5) return { ...base, phase: 'performing' };
  if (position < 7) return { ...base, phase: 'opening', doorOpen: smooth((position - 5) / 2) };
  if (position < 10) return { ...base, phase: 'entering', doorOpen: 1, travel: smooth((position - 7) / 3) };
  if (position < 13) return { ...base, phase: 'secured', doorOpen: 1 - smooth((position - 10) / 1.3), travel: 1 };
  if (position < 15) {
    const doorOpen = smooth((position - 13) / 0.6);
    return { ...base, phase: 'returning', doorOpen, travel: 1 - smooth((position - 13.6) / 1.4) };
  }
  return { ...base, phase: 'dispersing', dispersion: smooth((position - 15) / 3), doorOpen: 1 - smooth((position - 15) / 1.3) };
}
