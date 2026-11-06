import type { MascotTimeline } from '../types/mascot';

export const mascotCycleSeconds = 12;

/** The same scattered pose closes one cycle and opens the next, without a jump. */
export function getMascotTimeline(elapsed: number): MascotTimeline {
  const time = Math.max(0, elapsed);
  const cycle = Math.floor(time / mascotCycleSeconds);
  const position = time % mascotCycleSeconds;
  if (position < 2.4) {
    return { phase: 'assembling', cycle, dispersion: Math.pow(1 - position / 2.4, 3), action: 0 };
  }
  if (position < 9.6) {
    return { phase: 'performing', cycle, dispersion: 0, action: (position - 2.4) / 7.2 };
  }
  const progress = (position - 9.6) / 2.4;
  return { phase: 'dispersing', cycle, dispersion: progress * progress * (3 - 2 * progress), action: 1 };
}
