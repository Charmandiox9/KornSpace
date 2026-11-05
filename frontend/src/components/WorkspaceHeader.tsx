import type { WorkspaceHeaderProps } from '@/types';

export const WORKSPACE_TITLE_ID = 'workspace-title';

const iconClass = 'size-[18px] shrink-0 fill-none stroke-current stroke-[1.8]';

function PlusIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M12 11v5M9.5 13.5h5" />
    </svg>
  );
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * Encabezado del espacio de trabajo: ubicación actual, ruta de navegación y acciones.
 *
 * - `location` va de la raíz a la carpeta actual. Hoy tiene un solo elemento
 *   («Mi Unidad» o «Papelera»); con carpetas tendrá un elemento por ancestro.
 * - Cada acción solo se muestra si se pasa su callback ("cuando corresponda").
 */
export function WorkspaceHeader({ copy, location, onNavigate, onUploadClick, onCreateFolder }: WorkspaceHeaderProps) {
  const current = location[location.length - 1];
  const ancestors = location.slice(0, -1);
  if (!current) return null;

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line pb-5">
      <div className="min-w-0 flex-1 basis-48">
        {ancestors.length > 0 && (
          <nav aria-label={copy.location} className="mb-1.5">
            <ol className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-0.5 p-0 text-xs text-muted">
              {ancestors.map((item) => (
                <li className="flex min-w-0 items-center gap-1" key={item.id ?? 'root'}>
                  <button
                    type="button"
                    className={`min-h-6 max-w-[160px] cursor-pointer truncate rounded-md px-1 text-xs font-semibold text-accent hover:underline ${focusRing}`}
                    onClick={() => onNavigate?.(item.id)}
                    disabled={!onNavigate}
                  >
                    {item.name}
                  </button>
                  <span aria-hidden="true">/</span>
                </li>
              ))}
              <li className="min-w-0 max-w-[160px] truncate px-1 font-semibold text-ink" aria-current="page">{current.name}</li>
            </ol>
          </nav>
        )}
        <h1
          id={WORKSPACE_TITLE_ID}
          className="m-0 text-[clamp(22px,4vw,30px)] font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]"
        >
          {current.name}
        </h1>
      </div>
      {(onCreateFolder || onUploadClick) && (
        <div className="flex shrink-0 items-center gap-2">
          {onCreateFolder && (
            <button
              type="button"
              className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink transition-colors hover:border-accent-line hover:bg-accent-soft ${focusRing}`}
              onClick={onCreateFolder}
            >
              <FolderPlusIcon />
              <span className="max-[420px]:sr-only">{copy.newFolder}</span>
            </button>
          )}
          {onUploadClick && (
            <button
              type="button"
              className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-linear-to-br from-accent to-secondary px-3.5 text-[13px] font-semibold text-white shadow-md shadow-accent/25 ${focusRing}`}
              onClick={onUploadClick}
            >
              <PlusIcon />
              <span className="max-[420px]:sr-only">{copy.uploadFiles}</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
}
