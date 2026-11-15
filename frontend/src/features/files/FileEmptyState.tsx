import { RoosterMark } from '@/components/RoosterMark';
import type { FileEmptyStateProps } from '@/types';

export function FileEmptyState({ heading, description, uploadLabel, onUpload }: FileEmptyStateProps) {
  return <div className="flex flex-col items-center rounded-2xl border border-line bg-raised px-6 py-12 text-center sm:py-16">
    <span aria-hidden="true" className="mb-6 grid size-24 place-items-center rounded-2xl bg-accent-soft text-accent"><span className="size-20"><RoosterMark /></span></span>
    <h3 className="text-lg font-semibold tracking-tight text-ink">{heading}</h3>
    <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
    {onUpload && <button type="button" onClick={onUpload} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent hover:brightness-110"><svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4" /></svg>{uploadLabel}</button>}
  </div>;
}
