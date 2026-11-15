import type { WorkspaceDialogHeadingProps } from '@/types';

export function WorkspaceDialogHeading({ id, title, icon, resource, warning = false }: WorkspaceDialogHeadingProps) {
  return <div className="mb-6 flex items-start gap-4 border-b border-line pb-5">
    <span aria-hidden="true" className={`grid size-12 shrink-0 place-items-center rounded-xl ${warning ? 'bg-raised text-status' : 'bg-accent-soft text-accent'}`}><span className="grid size-8 place-items-center [&>svg]:size-full">{icon}</span></span>
    <div className="min-w-0 self-center">
      <h2 id={id} className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      {resource && <p className="mt-1 truncate text-sm text-muted" title={resource}>{resource}</p>}
    </div>
  </div>;
}
