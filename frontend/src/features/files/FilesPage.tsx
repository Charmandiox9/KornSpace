import { CreateFolderDialog } from '@/components/CreateFolderDialog';
import { WorkspaceHeader, WORKSPACE_TITLE_ID } from '@/components/WorkspaceHeader';
import { formatFileSize } from '@/lib/format-file-size';
import type { FilesPageProps } from '@/types';
import { animate, stagger } from 'animejs';
import Link from 'next/link';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';

export function FilesPage({
  copy,
  files,
  folders,
  currentFolder,
  breadcrumbs,
  currentFolderId,
  trash,
  notice,
  apiUrl,
  onUpload,
  onUploadDirectory,
  onNavigate,
  onMoveToTrash,
  onDeletePermanent,
  onRestore,
  onCreateFolder,
  initialTrash = false,
}: FilesPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const showTrash = initialTrash;
  const [fileToDelete, setFileToDelete] = useState<(typeof files)[number] | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [fileToConfirmDelete, setFileToConfirmDelete] = useState<(typeof files)[number] | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const entries = gridRef.current?.querySelectorAll<HTMLElement>('[data-grid-entry]');
    if (!entries?.length) return undefined;
    const animation = animate([...entries], {
      opacity: [0, 1],
      y: [12, 0],
      delay: stagger(28, { start: 16 }),
      duration: 280,
      ease: 'outCubic',
    });
    return () => { animation.revert(); };
  }, [breadcrumbs, currentFolderId, files, folders, showTrash]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    onUpload(files, currentFolderId);
  }

  function handleDirectoryChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    onUploadDirectory(files);
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
    onUpload(Array.from(event.dataTransfer.files), currentFolderId);
  }

  return (
    <section className="w-full min-w-0 max-w-[980px] self-center rounded-[20px] border border-line bg-surface p-[clamp(24px,5vw,48px)] shadow-panel max-[760px]:px-[18px] max-[760px]:py-6" aria-labelledby={WORKSPACE_TITLE_ID}>
      <WorkspaceHeader
        copy={copy}
        location={showTrash
          ? [{ id: null, name: copy.trashHeading }]
          : [
              { id: null, name: copy.myDrive },
              ...breadcrumbs.map((folder) => ({ id: folder.id, name: folder.name })),
              ...(currentFolder ? [{ id: currentFolder.id, name: currentFolder.name }] : []),
            ]}
        onNavigate={showTrash ? undefined : onNavigate}
        onUploadClick={showTrash ? undefined : () => fileInputRef.current?.click()}
        onUploadFolderClick={showTrash ? undefined : () => directoryInputRef.current?.click()}
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
        <input
          ref={directoryInputRef}
          className="sr-only"
          type="file"
          multiple
          aria-label={copy.selectFolder}
          // @ts-expect-error Chromium and WebKit expose this non-standard directory picker attribute.
          webkitdirectory=""
          onChange={handleDirectoryChange}
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
      <section ref={gridRef} className="pt-[26px] [&_h2]:mb-3.5 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:tracking-tight" aria-labelledby="files-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="files-heading" className="m-0">{showTrash ? copy.trashHeading : copy.filesHeading}</h2>
          <Link href={showTrash ? '/files' : '/trash'} className="shrink-0 text-xs font-semibold text-accent no-underline hover:underline">
            {showTrash ? copy.filesHeading : `${copy.trashHeading} (${trash.length})`}
          </Link>
        </div>
        {notice && <p className="m-0 mb-3 rounded-xl border border-line bg-raised px-4 py-3.5 text-[13px] leading-[1.6] text-muted" role="status">{notice}</p>}
        {!showTrash && folders.length > 0 && <>
          <h3 className="mb-2 mt-5 text-xs font-semibold text-muted">{copy.folderSection}</h3>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3 p-0">
            {folders.map((folder) => (
              <li key={folder.id} data-grid-entry className="min-w-0">
                <button type="button" onClick={() => onNavigate(folder.id)} className="group flex min-h-[72px] w-full items-center gap-3 rounded-xl border border-line bg-raised p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent-line hover:bg-accent-soft hover:shadow-md active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none">
                  <svg className="size-9 shrink-0 text-accent" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 9a2.5 2.5 0 0 1 2.5-2.5H13l3 3h9.5A2.5 2.5 0 0 1 28 12v12a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 4 24z" fill="currentColor" opacity=".16"/><path d="M4 11.5A2.5 2.5 0 0 1 6.5 9H13l3 3h9.5A2.5 2.5 0 0 1 28 14.5V24a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 4 24z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" title={folder.name}>{folder.name}</span>
                  <span className="text-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        </>}
        {(showTrash ? trash : files).length === 0 && (showTrash || folders.length === 0) ? (
          <p className="m-0 rounded-xl border border-line bg-raised px-4 py-3.5 text-[13px] leading-[1.6] text-muted">{showTrash ? copy.emptyTrash : currentFolderId ? copy.emptyFolder : copy.emptyFiles}</p>
        ) : <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3 p-0">
          {(showTrash ? trash : files).map((file) => {
            const mediaType = file.contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
            const isImage = ['image/avif', 'image/bmp', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'].includes(mediaType);
            const isVideo = ['video/mp4', 'video/ogg', 'video/webm'].includes(mediaType);
            const canPreview = !showTrash && file.status === 'AVAILABLE' && (isImage || isVideo);
            const previewUrl = apiUrl(`/api/files/${encodeURIComponent(file.id)}/preview`);
            return (
              <li key={file.id} data-grid-entry className="min-w-0">
                <article className="group overflow-hidden rounded-xl border border-line bg-raised transition duration-200 hover:-translate-y-0.5 hover:border-accent-line hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none">
                  <div className="relative grid aspect-[16/10] place-items-center overflow-hidden bg-surface text-muted">
                    {canPreview && isImage && <img className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none" src={previewUrl} alt={file.name} loading="lazy" />}
                    {canPreview && isVideo && <video className="size-full object-cover" src={previewUrl} controls muted playsInline preload="metadata" aria-label={file.name} />}
                    {!canPreview && <div className="grid justify-items-center gap-2 px-3 text-center"><svg className="size-10 text-accent" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M8 3.5h10l7 7V27a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" fill="currentColor" opacity=".12"/><path d="M18 3.5v7h7M10 18h12M10 22h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg><span className="text-[11px] font-medium">{file.status === 'AVAILABLE' ? copy.previewUnavailable : file.status === 'FAILED' ? copy.fileFailed : copy.fileProcessing}</span></div>}
                  </div>
                  <div className="grid gap-1.5 p-3">
                    <span className="truncate text-[13px] font-semibold" title={file.name}>{file.name}</span>
                    <span className="text-[11px] text-muted">{formatFileSize(file.sizeBytes)} · {file.status === 'AVAILABLE' ? copy.fileReady : file.status === 'FAILED' ? copy.fileFailed : copy.fileProcessing}{showTrash && file.deletedAt ? ` · ${copy.trashExpiry}` : ''}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2">
                      {!showTrash && file.status === 'AVAILABLE' && <a className="text-xs font-semibold text-accent no-underline hover:underline" href={apiUrl(`/api/files/${encodeURIComponent(file.id)}`)}>{copy.download}</a>}
                      {showTrash ? <><button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={() => onRestore(file.id)}>{copy.restoreFile}</button><button type="button" className="text-xs font-semibold text-status hover:underline" onClick={() => setFileToConfirmDelete(file)}>{copy.deletePermanently}</button></> : <button type="button" className="text-xs font-semibold text-muted hover:text-status" onClick={() => setFileToDelete(file)}>{copy.deleteFile}</button>}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>}
      </section>
      {isCreatingFolder && onCreateFolder && (
        <CreateFolderDialog copy={copy} onClose={() => setIsCreatingFolder(false)} onSubmit={(name) => onCreateFolder(name, currentFolderId)} />
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

