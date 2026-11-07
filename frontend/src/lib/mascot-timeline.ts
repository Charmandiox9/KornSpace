import type { MascotTimeline } from '../types/mascot';

export const mascotCycleSeconds = 22;

/** The same scattered pose closes one cycle and opens the next, without a jump. */
export function getMascotTimeline(elapsed: number): MascotTimeline {
  const time = Math.max(0, elapsed);
  const cycle = Math.floor(time / mascotCycleSeconds);
  const position = time % mascotCycleSeconds;
  const smooth = (value: number) => { const t = Math.min(1, Math.max(0, value)); return t * t * (3 - 2 * t); };
  const stored = position >= 11.5;
  const base = { cycle, dispersion: 0, action: Math.min(1, Math.max(0, (position - 2.4) / 16.6)), doorOpen: 0, travel: 0, carrying: !stored, stored };
  if (position < 2.4) return { ...base, phase: 'assembling', dispersion: Math.pow(1 - position / 2.4, 3) };
  if (position < 5) return { ...base, phase: 'performing' };
  if (position < 7) return { ...base, phase: 'opening', doorOpen: smooth((position - 5) / 2) };
  if (position < 11.5) return { ...base, phase: 'entering', doorOpen: 1, travel: smooth((position - 7) / 4.5) };
  if (position < 14.5) return { ...base, phase: 'secured', doorOpen: 1 - smooth((position - 11.5) / 1.3), travel: 1 };
  if (position < 19) {
    const doorOpen = smooth((position - 14.5) / 0.6);
    return { ...base, phase: 'returning', doorOpen, travel: 1 - smooth((position - 15.1) / 3.9) };
  }
  return { ...base, phase: 'dispersing', dispersion: smooth((position - 19) / 3), doorOpen: 1 - smooth((position - 19) / 1.3) };
}
