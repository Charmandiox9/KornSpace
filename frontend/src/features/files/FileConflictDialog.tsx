import { useEffect, useRef } from 'react';
import type { FileConflictDialogProps } from '@/types';

export function FileConflictDialog({ name, copy, onResolve }: FileConflictDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={() => onResolve(false)} aria-labelledby="conflict-title" className="fixed inset-0 m-auto w-[min(92vw,460px)] rounded-2xl border border-line bg-surface p-6 text-ink shadow-panel backdrop:bg-black/60">
    <h2 id="conflict-title" className="mb-3 text-lg font-semibold">{copy.fileNameConflict}</h2>
    <p className="mb-3 break-words text-sm font-semibold">{name}</p>
    <p className="mb-6 text-sm leading-6 text-muted">{copy.replaceDescription}</p>
    <div className="flex justify-end gap-2"><button type="button" className="min-h-11 rounded-xl px-4 text-sm hover:bg-raised" onClick={() => onResolve(false)}>{copy.cancel}</button><button type="button" className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-white" onClick={() => onResolve(true)}>{copy.replaceFile}</button></div>
  </dialog>;
}
