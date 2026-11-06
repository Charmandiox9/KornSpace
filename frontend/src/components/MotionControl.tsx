import { useMotionPreferences } from '@/hooks/use-motion-preferences';
import type { MotionControlProps } from '@/types';
export function MotionControl({ copy }: MotionControlProps) {
  const motion = useMotionPreferences();
  return <button type="button" disabled={motion.systemReduced} aria-pressed={!motion.enabled} aria-label={motion.systemReduced ? copy.systemReducedMotion : motion.enabled ? copy.reduceAnimations : copy.enableAnimations} title={motion.systemReduced ? copy.systemReducedMotion : motion.enabled ? copy.reduceAnimations : copy.enableAnimations} onClick={motion.toggle} className="grid size-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-muted transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-50 motion-reduce:transition-none">
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{motion.enabled ? <path d="M8 5v14M16 5v14" /> : <path d="m8 5 11 7-11 7V5Z" />}</svg>
  </button>;
}
