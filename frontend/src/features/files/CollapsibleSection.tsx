import type { CollapsibleSectionProps } from '@/types';
export function CollapsibleSection({ id, label, collapsible, children }: CollapsibleSectionProps) {
  const heading = <h2 id={id} className="text-[13px] font-semibold leading-5 text-muted">{label}</h2>;
  return <section className="mb-6" aria-labelledby={id}>{collapsible ? <details open className="group/section"><summary className="mb-3 flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg py-2 pr-3 hover:bg-accent-soft"><svg viewBox="0 0 20 20" className="size-4 -rotate-90 transition-transform duration-150 group-open/section:rotate-0 motion-reduce:transition-none" fill="none" stroke="currentColor" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg>{heading}</summary>{children}</details> : <><div className="mb-3">{heading}</div>{children}</>}</section>;
}
