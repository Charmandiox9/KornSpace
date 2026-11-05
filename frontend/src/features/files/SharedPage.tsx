import { WorkspaceHeader, WORKSPACE_TITLE_ID } from '@/components/WorkspaceHeader';
import { formatFileSize } from '@/lib/format-file-size';
import type { SharedPageProps } from '@/types';

/**
 * Vista «Compartidos conmigo». La raíz de lo compartido es de solo lectura, así que el
 * encabezado no ofrece subir ni crear carpetas aquí («cuando corresponda»).
 */
export function SharedPage({ copy, files, notice }: SharedPageProps) {
  return (
    <section className="w-full min-w-0 max-w-[980px] self-center rounded-[20px] border border-line bg-surface p-[clamp(24px,5vw,48px)] shadow-panel max-[760px]:px-[18px] max-[760px]:py-6 max-[420px]:px-3.5" aria-labelledby={WORKSPACE_TITLE_ID}>
      <WorkspaceHeader copy={copy} location={[{ id: null, name: copy.sharedWithMe }]} />
      <div className="pt-6">
        {notice && <p className="m-0 mb-3 rounded-xl border border-line bg-raised px-4 py-3.5 text-[13px] leading-[1.6] text-muted" role="status">{notice}</p>}
        {files.length === 0 ? (
          <p className="m-0 rounded-xl border border-line bg-raised px-4 py-3.5 text-[13px] leading-[1.6] text-muted">{copy.sharedEmpty}</p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {files.map((file) => (
              <li className="flex min-h-[68px] flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-line bg-raised px-[15px] py-3" key={file.id}>
                <div className="grid min-w-0 flex-1 basis-40 gap-[5px]">
                  <span className="truncate text-[13px] font-semibold" title={file.name}>{file.name}</span>
                  <span className="text-[11px] text-muted">{formatFileSize(file.sizeBytes)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
