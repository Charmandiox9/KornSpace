import { CreateFolderDialog } from '@/components/CreateFolderDialog';
import { WorkspaceHeader, WORKSPACE_TITLE_ID } from '@/components/WorkspaceHeader';
import { formatFileSize } from '@/lib/format-file-size';
import type { FilesPageProps } from '@/types';
import Link from 'next/link';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';

export function FilesPage({
  copy,
  files,
  trash,
  notice,
  apiUrl,
  onUpload,
  onMoveToTrash,
  onDeletePermanent,
  onRestore,
  onCreateFolder,
  initialTrash = false,
}: FilesPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const showTrash = initialTrash;
  const [fileToDelete, setFileToDelete] = useState<(typeof files)[number] | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [fileToConfirmDelete, setFileToConfirmDelete] = useState<(typeof files)[number] | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    onUpload(files);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    onUpload(Array.from(event.dataTransfer.files));
  }

  return (
    <section className="w-full min-w-0 max-w-[980px] self-center rounded-[20px] border border-line bg-surface p-[clamp(24px,5vw,48px)] shadow-panel max-[760px]:px-[18px] max-[760px]:py-6" aria-labelledby={WORKSPACE_TITLE_ID}>
      <WorkspaceHeader
        copy={copy}
        location={[{ id: null, name: showTrash ? copy.trashHeading : copy.myDrive }]}
        onUploadClick={showTrash ? undefined : () => fileInputRef.current?.click()}
        onCreateFolder={showTrash || !onCreateFolder ? undefined : () => setIsCreatingFolder(true)}
      />
      {!showTrash && <div
        role="region"
        aria-label={copy.uploadZone}
        onDragEnter={handleDragEnter}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={`mt-6 grid justify-items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors motion-reduce:transition-none ${isDragging ? 'border-accent bg-accent-soft' : 'border-line bg-raised'}`}
      >
        <p className="text-sm font-semibold text-ink">{isDragging ? copy.dropFilesNow : copy.dropFilesHere}</p>
        <p id="upload-hint" className="text-xs text-muted">{copy.uploadMultipleHint}</p>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          multiple
          aria-label={copy.selectFiles}
          aria-describedby="upload-hint"
          onChange={handleFileChange}
        />
        <button
          className="inline-flex min-h-[46px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 px-[17px] text-[13px] font-semibold text-white shadow-md shadow-accent/25 disabled:cursor-wait disabled:opacity-70 [&_span]:text-xl [&_span]:leading-none max-[760px]:w-full bg-linear-to-br from-accent to-secondary"
          type="button"
          aria-describedby="upload-hint"
          onClick={() => fileInputRef.current?.click()}
        >
          <span aria-hidden="true">＋</span>{copy.selectFiles}
        </button>
      </div>}
      <section className="pt-[26px] [&_h2]:mb-3.5 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:tracking-tight" aria-labelledby="files-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="files-heading" className="m-0">{showTrash ? copy.trashHeading : copy.filesHeading}</h2>
          <Link href={showTrash ? '/files' : '/trash'} className="shrink-0 text-xs font-semibold text-accent no-underline hover:underline">
            {showTrash ? copy.filesHeading : `${copy.trashHeading} (${trash.length})`}
          </Link>
        </div>
        {notice && <p className="m-0 mb-3 rounded-xl border border-line bg-raised px-4 py-3.5 text-[13px] leading-[1.6] text-muted" role="status">{notice}</p>}
        {(showTrash ? trash : files).length === 0 ? (
          <p className="m-0 rounded-xl border border-line bg-raised px-4 py-3.5 text-[13px] leading-[1.6] text-muted">{showTrash ? copy.emptyTrash : copy.emptyFiles}</p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {(showTrash ? trash : files).map((file) => (
              <li className="flex min-h-[68px] flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-line bg-raised px-[15px] py-3" key={file.id}>
                <div className="grid min-w-0 flex-1 basis-40 gap-[5px]">
                  <span className="truncate text-[13px] font-semibold" title={file.name}>{file.name}</span>
                  <span className="text-[11px] text-muted">
                    {formatFileSize(file.sizeBytes)} · {file.status === 'AVAILABLE' ? copy.fileReady : file.status === 'FAILED' ? copy.fileFailed : copy.fileProcessing}
                    {showTrash && file.deletedAt ? ` · ${copy.trashExpiry}` : ''}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {!showTrash && file.status === 'AVAILABLE' && <a className="text-xs font-semibold text-accent no-underline hover:underline" href={apiUrl(`/api/files/${encodeURIComponent(file.id)}`)}>{copy.download}</a>}
                  {showTrash ? <>
                    <button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={() => onRestore(file.id)}>{copy.restoreFile}</button>
                    <button type="button" className="text-xs font-semibold text-status hover:underline" onClick={() => setFileToConfirmDelete(file)}>{copy.deletePermanently}</button>
                  </> : <button type="button" className="text-xs font-semibold text-muted hover:text-status" onClick={() => setFileToDelete(file)}>{copy.deleteFile}</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {isCreatingFolder && onCreateFolder && (
        <CreateFolderDialog copy={copy} onClose={() => setIsCreatingFolder(false)} onSubmit={onCreateFolder} />
      )}
      {fileToDelete && (
        <div className="fixed inset-0 z-80 grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFileToDelete(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-choice-title" className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <h2 id="delete-choice-title" className="mb-2 text-lg font-semibold">{copy.deleteChoiceTitle}</h2>
            <p className="mb-5 truncate text-sm text-muted" title={fileToDelete.name}>{fileToDelete.name}</p>
            <div className="grid gap-2">
              <button type="button" className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-white" onClick={() => { onMoveToTrash(fileToDelete); setFileToDelete(null); }}>{copy.trashChoice}</button>
              <button type="button" className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-status" onClick={() => { onDeletePermanent(fileToDelete.id); setFileToDelete(null); }}>{copy.permanentChoice}</button>
              <button type="button" className="min-h-10 text-sm text-muted" onClick={() => setFileToDelete(null)}>{copy.cancel}</button>
            </div>
          </section>
        </div>
      )}
      {fileToConfirmDelete && (
        <div className="fixed inset-0 z-80 grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFileToConfirmDelete(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="permanent-delete-title" className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <h2 id="permanent-delete-title" className="mb-2 text-lg font-semibold">{copy.confirmPermanentTitle}</h2>
            <p className="mb-2 text-sm text-muted">{copy.confirmPermanentDescription}</p>
            <p className="mb-5 truncate text-sm font-semibold text-ink" title={fileToConfirmDelete.name}>{fileToConfirmDelete.name}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="min-h-10 rounded-xl px-4 text-sm text-muted hover:bg-raised" onClick={() => setFileToConfirmDelete(null)}>{copy.cancel}</button>
              <button type="button" className="min-h-10 rounded-xl bg-status px-4 text-sm font-semibold text-white" onClick={() => { onDeletePermanent(fileToConfirmDelete.id); setFileToConfirmDelete(null); }}>{copy.deletePermanently}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

