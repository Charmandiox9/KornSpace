import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CreateFolderDialog } from '@/components/CreateFolderDialog';
import { WorkspaceHeader, WORKSPACE_TITLE_ID } from '@/components/WorkspaceHeader';
import { formatFileSize } from '@/lib/format-file-size';
import type { FilesPageProps, FolderActionSelection, DraggedResource, ResourceActivity, StoredFile, StoredFolder, SortOrder } from '@/types';
import { useMotionPreferences } from '@/hooks/use-motion-preferences';
import { RoosterMark } from '@/components/RoosterMark';
import { useFileDrop } from '@/hooks/use-file-drop';
import { ActionIcon } from './ActionIcon';
import { ItemOrganizeMenu } from './ItemOrganizeMenu';
import { itemColors, sortResources } from './item-organization';
import { FolderActionDialog } from './FolderActionDialog';
import dynamic from 'next/dynamic';
const FileViewer = dynamic(() => import('./FileViewer').then((module) => module.FileViewer));
import { FileEditDialog } from './FileEditDialog';
import { authenticatedFetch } from '@/lib/api-client';
import { sileo } from 'sileo';
import Link from 'next/link';
import { ActionMenu } from './ActionMenu';
import { CollapsibleSection } from './CollapsibleSection';
import { ShareAccessList } from './ShareAccessList';
import { useSession } from '@/features/auth/SessionProvider';

export function FilesPage({ collapsibleSections = false, listView = false, initialSortOrder = 'nameAsc', foldersLabel, filesLabel, emptyLabel, itemPreferences = [], showQuickAccess = false, onOrganize, userId, copy, files, folders, currentFolder, breadcrumbs, currentFolderId, trash, notice, apiUrl, onUpload, onUploadDirectory, onNavigate, onMoveToTrash, onDeletePermanent, onRestore, onCreateFolder, onChanged, title, toolbar, initialTrash = false, isLoading = false }: FilesPageProps) {
  const { user } = useSession();
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);
  const [actionSelection, setActionSelection] = useState<string | null>(null);
  function selectAction(kind: 'files' | 'folders', id: string) { setActionSelection(`${kind}:${id}`); setSelected(null); setFolderDetails(null); }
  function dismissAction() { setActionSelection(null); setSelected(null); setFolderDetails(null); }
  const [folderDetails, setFolderDetails] = useState<StoredFolder | null>(null);
  const preferencesById = useMemo(() => new Map(itemPreferences.map((item) => [`${item.kind}:${item.id}`, item])), [itemPreferences]);
  const preference = (kind: 'files' | 'folders', id: string) => preferencesById.get(`${kind}:${id}`);
  const [folderAction, setFolderAction] = useState<FolderActionSelection | null>(null);
  const previousPositions = useRef(new Map<string, DOMRect>());
  const { enabled: motionEnabled } = useMotionPreferences();
  const fileInput = useRef<HTMLInputElement>(null);
  const directoryInput = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<StoredFile | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'details' | 'activity'>('details');
  const [activity, setActivity] = useState<ResourceActivity[]>([]);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [viewing, setViewing] = useState<StoredFile | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<StoredFile | null>(null);
  const [editing, setEditing] = useState<StoredFile | null>(null);
  const [editMode, setEditMode] = useState<'rename' | 'share'>('rename');
  const [emptying, setEmptying] = useState(false);
  const [emptyBusy, setEmptyBusy] = useState(false);
  const emptyDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (emptying) emptyDialog.current?.showModal(); }, [emptying]);
  const canWriteContents = !currentFolder || currentFolder.ownerId === userId || currentFolder.permission === 'EDITOR';
  async function moveItem(resource: DraggedResource, destinationId: string | null) {
    try {
      const response = await authenticatedFetch(`/api/${resource.kind}/${encodeURIComponent(resource.id)}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destinationId }) });
      if (!response.ok) throw new Error();
      setSelected(null); setFolderDetails(null);
      await onChanged?.();
      sileo.success({ title: copy.activityMoved });
    } catch { sileo.error({ title: copy.fileActionFailed }); }
  }
  const { isInternalDrag, startDrag, isDragging: dragging, targetFolderId: dropFolderId } = useFileDrop({ folders, currentFolderId, onMove: (resource, destinationId) => void moveItem(resource, destinationId), enabled: canWriteContents && !folderAction && !initialTrash && !creating && !deleting && !viewing && !editing, onUpload: (files, folderId) => onUpload(files, folderId, folders.find((folder) => folder.id === folderId)?.name ?? (folderId === currentFolderId ? currentFolder?.name : null) ?? copy.myDrive) });
  const dropFolderName = dropFolderId === null ? copy.myDrive : [...folders, ...breadcrumbs].find((folder) => folder.id === dropFolderId)?.name ?? currentFolder?.name ?? copy.myDrive;
  const shownFiles = sortResources(initialTrash ? trash : files, sortOrder);
  const shownFolders = sortResources(folders, sortOrder);
  useEffect(() => {
    if (deleting) deleteDialog.current?.showModal();
  }, [deleting]);
  const selectedFile = shownFiles.find((file) => file.id === selected?.id) ?? null;
  useEffect(() => {
    if (!selectedFile && !folderDetails && !actionSelection) return;
    const handleBlankPointer = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('aside, dialog, [data-entry], [data-action-menu], button, a, input, textarea, select, label, summary, details, [role="tab"]')) return;
      setSelected(null);
      setFolderDetails(null);
      setActionSelection(null);
    };
    document.addEventListener('pointerdown', handleBlankPointer, true);
    document.addEventListener('click', handleBlankPointer, true);
    return () => {
      document.removeEventListener('pointerdown', handleBlankPointer, true);
      document.removeEventListener('click', handleBlankPointer, true);
    };
  }, [selectedFile?.id, folderDetails?.id, actionSelection]);
  useEffect(() => {
    const item = selectedFile ? { kind: 'files', id: selectedFile.id } : folderDetails ? { kind: 'folders', id: folderDetails.id } : null;
    setDetailsTab('details'); setActivity([]); setDescriptionDraft(item ? (selectedFile?.description ?? folderDetails?.description ?? '') : '');
    if (!item) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await authenticatedFetch(`/api/${item.kind}/${encodeURIComponent(item.id)}/activity`, { signal: controller.signal });
        const payload: unknown = await response.json();
        if (response.ok && Array.isArray(payload) && !controller.signal.aborted) setActivity(payload.filter((entry): entry is ResourceActivity => typeof entry === 'object' && entry !== null && 'id' in entry && 'action' in entry && 'actorName' in entry && 'createdAt' in entry));
      } catch { /* Activity is supplementary to item details. */ }
    })();
    return () => controller.abort();
  }, [selectedFile?.id, folderDetails?.id]);
  async function saveDescription(kind: 'files' | 'folders', id: string) {
    if (savingDescription) return;
    setSavingDescription(true);
    try {
      const response = await authenticatedFetch(`/api/${kind}/${encodeURIComponent(id)}/description`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: descriptionDraft }) });
      if (!response.ok) throw new Error();
      sileo.success({ title: copy.saveDescription });
      await onChanged?.();
    } catch { sileo.error({ title: copy.fileActionFailed }); }
    finally { setSavingDescription(false); }
  }
  useEffect(() => { setHost(document.getElementById('workspace-create-actions')); }, []);
  useEffect(() => { setSelected(null); setViewing(null); setFolderDetails(null); setActionSelection(null); }, [currentFolderId, initialTrash]);
  useEffect(() => { previousPositions.current.clear(); }, [currentFolderId, initialTrash]);
  useLayoutEffect(() => {
    if (isLoading) return;
    const positions = new Map<string, DOMRect>();
    const animations: Animation[] = [];
    grid.current?.querySelectorAll<HTMLElement>('[data-entry]').forEach((entry) => {
      const id = entry.dataset.entry ?? '';
      const rect = entry.getBoundingClientRect(); positions.set(id, rect);
      const previous = previousPositions.current.get(id);
      if (!motionEnabled || !previous || document.documentElement.dataset.input === 'keyboard') return;
      const x = previous.left - rect.left, y = previous.top - rect.top;
      if (Math.abs(x) + Math.abs(y) < 1) return;
      animations.push(entry.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }], { duration: 240, easing: getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim() }));
    });
    previousPositions.current = positions;
    return () => animations.forEach((animation) => animation.cancel());
  }, [files, folders, sortOrder, isLoading, motionEnabled]);

  function closeMenu(element: HTMLElement) { element.closest('details')?.removeAttribute('open'); }
  const previewUrl = (file: StoredFile) => apiUrl(`/api/files/${encodeURIComponent(file.id)}/preview${initialTrash && file.deletedAt ? '?trash=true' : ''}`);
  const downloadUrl = (file: StoredFile) => apiUrl(`/api/files/${encodeURIComponent(file.id)}`);
  const canOpen = (file: StoredFile) => !initialTrash && !file.deletedAt && file.status === 'AVAILABLE';
  const canPreview = (file: StoredFile) => file.status === 'AVAILABLE' && (!file.deletedAt && !initialTrash || initialTrash && file.ownerId === userId);
  const isImage = (file: StoredFile) => ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'].includes(file.contentType.split(';')[0]);
  const isVideo = (file: StoredFile) => ['video/mp4', 'video/webm', 'video/ogg'].includes(file.contentType.split(';')[0]);
  const isPdf = (file: StoredFile) => file.contentType.split(';')[0] === 'application/pdf';
  const navigableFiles = shownFiles.filter(canOpen);
  const viewingIndex = viewing ? navigableFiles.findIndex((file) => file.id === viewing.id) : -1;

  const showListView = listView && !initialTrash;

  return <section className="min-w-0 w-full flex-1" aria-labelledby={WORKSPACE_TITLE_ID}>
    {dragging && createPortal(<div data-file-drop-overlay className="pointer-events-none fixed inset-2 z-[100] rounded-2xl border-2 border-accent bg-accent/5 motion-safe:transition-colors" aria-hidden="true"><div className="absolute inset-x-4 bottom-8 flex justify-center"><span className="max-w-full truncate rounded-2xl border border-accent-line bg-surface px-6 py-4 text-sm font-semibold text-accent shadow-panel">{isInternalDrag ? copy.moveToFolder : copy.dropFilesNow} · {dropFolderName}</span></div></div>, document.body)}
    <p className="sr-only" role="status" aria-live="polite">{dragging ? `${isInternalDrag ? copy.moveToFolder : copy.dropFilesNow} · ${dropFolderName}` : ''}</p>
    {host && canWriteContents && !initialTrash && createPortal(<details className="relative">
      <summary aria-label={copy.newAction} title={copy.newAction} className="grid size-12 cursor-pointer list-none place-items-center rounded-2xl bg-linear-to-br from-accent to-secondary text-3xl text-white shadow-md shadow-accent/15 transition-colors duration-150 hover:brightness-110"><svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></summary>
      <div className="absolute left-0 z-50 mt-3 grid w-52 gap-1 rounded-xl border border-line bg-surface p-2 shadow-panel" onClick={(event) => closeMenu(event.currentTarget)}>
        <button type="button" className="rounded-lg px-3 py-3 text-left text-sm hover:bg-raised" onClick={() => fileInput.current?.click()}>{copy.uploadFiles}</button>
        <button type="button" className="rounded-lg px-3 py-3 text-left text-sm hover:bg-raised" onClick={() => directoryInput.current?.click()}>{copy.uploadFolder}</button>
        {onCreateFolder && <button type="button" className="border-t border-line px-3 py-3 text-left text-sm hover:bg-raised" onClick={() => setCreating(true)}>{copy.newFolder}</button>}
      </div>
    </details>, host)}
    <WorkspaceHeader isDragging={dragging} dropTargetId={dropFolderId} copy={copy} location={title ? [{ id: null, name: title }] : initialTrash ? [{ id: null, name: copy.trashHeading }] : [{ id: null, name: copy.myDrive }, ...breadcrumbs.map((folder) => ({ id: folder.id, name: folder.name })), ...(currentFolder ? [{ id: currentFolder.id, name: currentFolder.name }] : [])]} onNavigate={initialTrash ? undefined : onNavigate} detailsOpen={detailsOpen} onToggleDetails={() => setDetailsOpen((open) => !open)} />
    {showQuickAccess && (['shortcut'] as const).map((category) => {
      const entries = itemPreferences.filter((item) => item[category]);
      if (!entries.length) return null;
      return <section key={category} aria-label={copy.quickAccess} className="mt-5 border-b border-line pb-5">
        <h2 className="mb-3 text-sm font-semibold">{copy.quickAccess}</h2>
        <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 p-0">{entries.map((entry) => <li key={`${entry.kind}:${entry.id}`}><button type="button" disabled={entry.file !== undefined && entry.file.status !== 'AVAILABLE'} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-raised px-3 py-2 text-left text-sm hover:bg-accent-soft" onClick={() => { if (entry.folder) onNavigate(entry.id); else if (entry.file) setViewing(entry.file); }}><span style={{ color: itemColors[entry.color] }}><ActionIcon name={entry.kind === 'folders' ? 'organize' : 'open'} /></span><span className="min-w-0 truncate">{entry.folder?.name ?? entry.file?.name}</span></button></li>)}</ul>
      </section>;
    })}
    <input ref={fileInput} type="file" multiple className="sr-only" aria-label={copy.selectFiles} onChange={(event) => { onUpload(Array.from(event.target.files ?? []), currentFolderId, currentFolder?.name ?? copy.myDrive); event.target.value = ''; }} />
    <input ref={directoryInput} type="file" multiple className="sr-only" aria-label={copy.selectFolder}
      // @ts-expect-error Browser directory picker extension.
      webkitdirectory="" onChange={(event) => { onUploadDirectory(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
    {!initialTrash && currentFolder && currentFolder.ownerId === userId && <button type="button" className="mt-3 min-h-11 rounded-lg px-3 text-sm text-accent hover:bg-accent-soft" onClick={() => setFolderAction({ folder: currentFolder, action: 'share' })}><ActionIcon name="share" />{copy.shareFolder}</button>}
    <div className="flex items-start gap-0">
      <div ref={grid} className={`min-w-0 flex-1 py-4 ${detailsOpen ? 'min-[1101px]:pr-80' : ''}`} aria-busy={isLoading}>
        {toolbar}
        <div className="mb-1 flex justify-end"><label className="flex items-center gap-2 text-xs text-muted">{copy.sortBy}<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} className="min-h-10 rounded-lg border border-line bg-raised px-3 text-ink">{(showListView ? ['sizeDesc', 'sizeAsc'] as const : ['nameAsc', 'nameDesc', 'modifiedDesc', 'modifiedAsc', 'sizeDesc', 'sizeAsc'] as const).map((order) => <option key={order} value={order}>{copy[order]}</option>)}</select></label></div>
        {initialTrash && trash.length > 0 && <div className="mb-5 flex justify-end"><button type="button" className="min-h-10 rounded-xl border border-line px-4 text-xs font-semibold text-status hover:bg-raised" onClick={() => setEmptying(true)}>{copy.emptyTrashAction}</button></div>}
        {notice && <p role="status" className="mb-5 rounded-xl border border-line bg-raised p-4 text-sm text-muted">{notice}</p>}
        {isLoading ? <div role="status" aria-label={copy.loadingFiles} className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="animate-pulse overflow-hidden rounded-2xl border border-line bg-raised motion-reduce:animate-none"><div className="aspect-[4/3] bg-line/40" /><div className="space-y-3 p-4"><div className="h-3 w-3/4 rounded bg-line" /><div className="h-2 w-1/2 rounded bg-line/60" /></div></div>)}</div> : <>
          {!initialTrash && folders.length > 0 && <CollapsibleSection id="folders-heading" label={foldersLabel ?? copy.folderSection} collapsible={collapsibleSections}>
            <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4 p-0">
              {shownFolders.map((folder) => <li draggable={folder.permission !== 'READER' && !initialTrash} onDragStart={(event) => { if (folder.permission === 'READER' || initialTrash) event.preventDefault(); else startDrag(event, { kind: 'folders', id: folder.id, parentId: folder.parentId }); }} data-entry={folder.id} key={folder.id} className="relative min-w-0 focus-within:z-40">
                <div data-selected={folderDetails?.id === folder.id || actionSelection === `folders:${folder.id}`} className={`group flex min-h-16 items-center rounded-xl border border-line bg-raised transition-colors duration-150 hover:border-accent-line hover:bg-accent-soft motion-reduce:transition-none ${folderDetails?.id === folder.id || actionSelection === `folders:${folder.id}` || dragging && dropFolderId === folder.id ? 'border-accent bg-accent-soft ring-2 ring-accent/40' : ''}`}>
                  <button type="button" data-upload-folder-id={folder.id} aria-pressed={folderDetails?.id === folder.id} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl px-4 text-left" onClick={() => { setFolderDetails(folder); setSelected(null); setActionSelection(null); }} onDoubleClick={() => onNavigate(folder.id)}>
                    <svg style={{ color: itemColors[preference('folders', folder.id)?.color ?? 'DEFAULT'] }} className="size-7 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z" fill="currentColor" fillOpacity=".12" /></svg>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.name}</span>{preference('folders', folder.id)?.starred && <span className="text-accent"><ActionIcon name="star" /></span>}
                  </button>
                  <ActionMenu label={`${copy.folderActions}: ${folder.name}`} onSelect={() => selectAction('folders', folder.id)} onDismiss={dismissAction}>
                      <button type="button" className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-left hover:bg-raised" onClick={() => onNavigate(folder.id)}><ActionIcon name="open" />{copy.openFile}</button>
                      <button type="button" disabled={folder.permission === 'READER'} title={folder.permission === 'READER' ? copy.readOnlyAction : undefined} aria-label={`${copy.renameFolder}: ${folder.name}`} className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setFolderAction({ folder, action: 'rename' })}><ActionIcon name="rename" />{copy.renameFolder}</button>
                      {folder.ownerId === userId && <button type="button" aria-label={`${copy.shareFolder}: ${folder.name}`} className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-raised" onClick={() => setFolderAction({ folder, action: 'share' })}><ActionIcon name="share" />{copy.shareFolder}</button>}
                      {onOrganize && <ItemOrganizeMenu preference={preference('folders', folder.id)} copy={copy} onUpdate={(patch) => onOrganize('folders', folder.id, patch)} />}
                      <button type="button" className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-left hover:bg-raised" onClick={() => { setFolderDetails(folder); setSelected(null); }}><ActionIcon name="info" />{copy.folderDetails}</button>
                      <button type="button" disabled={folder.permission === 'READER'} title={folder.permission === 'READER' ? copy.readOnlyAction : undefined} aria-label={`${copy.deleteFolder}: ${folder.name}`} className="flex min-h-10 items-center gap-3 border-t border-line px-3 py-2 text-left text-status hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setFolderAction({ folder, action: 'delete' })}><ActionIcon name="delete" />{copy.deleteFolder}</button>
                  </ActionMenu>
                </div>
              </li>)}
            </ul>
          </CollapsibleSection>}
          {(collapsibleSections ? [{ id: 'files-heading', label: filesLabel ?? copy.suggestedFiles, entries: shownFiles.filter((file) => !isVideo(file)) }, { id: 'videos-heading', label: copy.suggestedVideos, entries: shownFiles.filter(isVideo) }] : [{ id: 'files-heading', label: initialTrash ? copy.trashHeading : filesLabel ?? copy.filesHeading, entries: shownFiles }]).map((group) => <CollapsibleSection key={group.id} id={group.id} label={group.label} collapsible={collapsibleSections}>
            {!notice && shownFiles.length === 0 && <p className="rounded-xl border border-dashed border-line px-5 py-12 text-center text-sm text-muted"><span className="mx-auto mb-3 block size-12 text-accent" aria-hidden="true"><RoosterMark /></span>{emptyLabel ?? (initialTrash ? copy.emptyTrash : currentFolderId ? copy.emptyFolder : collapsibleSections ? copy.emptySuggestions : copy.emptyFiles)}</p>}
            {showListView && <div className="mb-1 flex justify-between border-b border-line px-3 py-3 text-xs font-semibold text-muted"><span>{copy.fileName}</span><span className="w-28 text-right">{copy.fileSize}</span></div>}
            <ul className={showListView ? "list-none divide-y divide-line p-0" : "grid list-none grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4 p-0"}>{group.entries.map((file) => <li draggable={file.permission !== 'READER' && !file.deletedAt && !initialTrash} onDragStart={(event) => { if (file.permission === 'READER' || file.deletedAt || initialTrash) event.preventDefault(); else startDrag(event, { kind: 'files', id: file.id, parentId: file.folderId ?? null }); }} data-entry={file.id} key={file.id} className="relative min-w-0 focus-within:z-40"><article data-selected={selectedFile?.id === file.id || actionSelection === `files:${file.id}`} className={`group relative border bg-raised transition-colors duration-150 hover:border-accent-line motion-reduce:transition-none ${showListView ? "flex items-center border-transparent" : "rounded-2xl"} ${selectedFile?.id === file.id || actionSelection === `files:${file.id}` ? 'border-accent ring-2 ring-accent/20' : 'border-line'}`}>
              <div className={`flex min-w-0 items-center gap-2 px-3 py-2 ${showListView ? "flex-1" : ""}`}><span aria-hidden="true" style={{ color: itemColors[preference('files', file.id)?.color ?? 'DEFAULT'] }} className="text-[10px] font-bold uppercase text-accent">{file.name.split('.').pop()?.slice(0, 5)}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold" title={file.name}>{showListView ? <button type="button" className="truncate text-left" onClick={() => setSelected(file)}>{file.name}</button> : file.name}{file.deletedAt && <span className="ml-2 text-muted">{copy.inTrash}</span>}</span>{preference('files', file.id)?.starred && <span className="text-accent"><ActionIcon name="star" /></span>}
                <ActionMenu label={`${copy.fileActions}: ${file.name}`} onSelect={() => selectAction('files', file.id)} onDismiss={dismissAction}>
                  {canOpen(file) && <><button type="button" className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-left hover:bg-raised" onClick={() => setViewing(file)}><ActionIcon name="open" />{copy.openFile}</button><a className="flex min-h-10 items-center gap-3 rounded-lg px-3 hover:bg-raised" href={downloadUrl(file)}><ActionIcon name="download" />{copy.download}</a></>}
                  {!initialTrash && !file.deletedAt && <button type="button" disabled={file.permission === 'READER'} title={file.permission === 'READER' ? copy.readOnlyAction : undefined} className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-left hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { setEditMode('rename'); setEditing(file); }}><ActionIcon name="rename" />{copy.renameFile}</button>}
                  {!initialTrash && !file.deletedAt && (!file.permission || file.permission === 'OWNER') && <button type="button" className="flex min-h-10 items-center gap-3 border-t border-line px-3 text-left hover:bg-raised" onClick={() => { setEditMode('share'); setEditing(file); }}><ActionIcon name="share" />{copy.shareFile}</button>}
                  {!initialTrash && !file.deletedAt && onOrganize && <ItemOrganizeMenu preference={preference('files', file.id)} copy={copy} onUpdate={(patch) => onOrganize('files', file.id, patch)} />}
                  {file.deletedAt && !initialTrash && <Link href="/trash" className="flex min-h-10 items-center gap-3 px-3 text-accent">{copy.inTrash}</Link>}
                  <button type="button" className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-left hover:bg-raised" onClick={() => { setSelected(file); setFolderDetails(null); }}><ActionIcon name="info" />{copy.fileDetails}</button>
                  {initialTrash && <button type="button" className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-accent hover:bg-raised" onClick={() => onRestore(file.id)}><ActionIcon name="open" />{copy.restoreFile}</button>}
                  {(initialTrash && file.permission !== 'READER' || !initialTrash && !file.deletedAt) && <button type="button" disabled={!initialTrash && file.permission === 'READER'} title={!initialTrash && file.permission === 'READER' ? copy.readOnlyAction : undefined} className="flex min-h-10 items-center gap-3 border-t border-line px-3 text-left text-status hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setDeleting(file)}><ActionIcon name="delete" />{initialTrash ? copy.deletePermanently : copy.deleteFile}</button>}
                </ActionMenu>
              </div>
              {showListView ? <button type="button" className="min-h-12 w-28 shrink-0 px-3 text-right text-xs tabular-nums" onClick={() => setSelected(file)}>{formatFileSize(file.sizeBytes)}</button> : <button type="button" aria-label={`${copy.fileDetails}: ${file.name}`} aria-pressed={selectedFile?.id === file.id} onClick={() => setSelected(file)} onDoubleClick={() => { if (canOpen(file)) setViewing(file); }} className="block w-full rounded-b-2xl px-2 pb-3 text-left focus-visible:outline-2 focus-visible:outline-accent">
                <span className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-surface text-muted">{canPreview(file) && isImage(file) ? <img className="size-full object-cover" src={previewUrl(file)} alt="" loading="lazy" /> : canPreview(file) && isVideo(file) ? <><video className="size-full object-cover" src={previewUrl(file)} muted playsInline preload="metadata" /><span className="absolute grid size-12 place-items-center rounded-full bg-black/50 text-xl text-white" aria-hidden="true">▷</span></> : <span className="grid justify-items-center gap-3 p-4"><span className="text-4xl text-accent" aria-hidden="true">▤</span><span className="break-all text-center text-xs">{file.status === 'AVAILABLE' ? file.contentType : file.status === 'FAILED' ? copy.fileFailed : copy.fileProcessing}</span></span>}</span>
                <span className="block px-2 pt-3 text-[11px] text-muted">{formatFileSize(file.sizeBytes)} · {file.status === 'AVAILABLE' ? copy.fileReady : file.status === 'FAILED' ? copy.fileFailed : copy.fileProcessing}</span>
              </button>}
              {!showListView && title && file.ownerName && <div className="flex items-center gap-2 border-t border-line px-3 py-3 text-[11px] text-muted"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent" aria-hidden="true">{file.ownerName.slice(0, 1)}</span><span className="min-w-0 truncate">{file.ownerName}{file.openedAt ? ' · ' + new Intl.DateTimeFormat(copy.socialLocale.replace('_', '-'), { dateStyle: 'short' }).format(new Date(file.openedAt)) : ''}</span></div>}
            </article></li>)}</ul>
          </CollapsibleSection>)}
        </>}
      </div>
      {detailsOpen && <aside aria-label={selectedFile ? copy.fileDetails : folderDetails ? copy.folderDetails : copy.detailsTab} className="fixed inset-y-4 right-4 z-50 h-auto w-80 max-w-[calc(100vw-2rem)] shrink-0 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin] rounded-2xl border border-line bg-surface shadow-2xl min-[1101px]:top-20 min-[1101px]:right-0 min-[1101px]:bottom-0 min-[1101px]:rounded-none min-[1101px]:border-y-0 min-[1101px]:border-r-0">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-5 py-4"><span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">{selectedFile ? '▤' : folderDetails ? '▰' : 'ⓘ'}</span><h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{selectedFile?.name ?? folderDetails?.name ?? copy.detailsTab}</h2><button type="button" aria-label={copy.closePanel} className="grid size-9 shrink-0 place-items-center rounded-full text-xl hover:bg-raised" onClick={() => setDetailsOpen(false)}>×</button></div>
        {!selectedFile && !folderDetails ? <p className="p-5 text-xs text-muted">{copy.detailsTab}</p> : <>
        <div role="tablist" aria-label={selectedFile ? copy.fileDetails : copy.folderDetails} className="flex border-b border-line px-4"><button type="button" role="tab" aria-selected={detailsTab === 'details'} onClick={() => setDetailsTab('details')} className={`min-h-12 border-b-2 px-3 text-xs font-semibold ${detailsTab === 'details' ? 'border-accent text-accent' : 'border-transparent text-muted'}`}>{copy.detailsTab}</button><button type="button" role="tab" aria-selected={detailsTab === 'activity'} onClick={() => setDetailsTab('activity')} className={`min-h-12 border-b-2 px-3 text-xs font-semibold ${detailsTab === 'activity' ? 'border-accent text-accent' : 'border-transparent text-muted'}`}>{copy.activityTab}</button></div>
        {detailsTab === 'activity' ? <section role="tabpanel" className="grid gap-4 p-5">{activity.length === 0 ? <p className="text-xs text-muted">{copy.activityEmpty}</p> : activity.map((entry) => {
          const action = entry.action === 'MOVED' ? copy.activityMoved : entry.action === 'OPENED' ? copy.activityOpened : entry.action === 'DESCRIPTION_UPDATED' ? copy.activityDescriptionUpdated : entry.action === 'RENAMED' ? copy.activityRenamed : entry.action === 'UPLOADED' ? copy.activityUploaded : entry.action === 'FILE_TRASHED' ? copy.activityTrashed : entry.action === 'FILE_RESTORED' ? copy.activityRestored : entry.action === 'CREATED' ? copy.activityCreated : entry.action === 'ACCESS_GRANTED' ? copy.activityAccessGranted : entry.action === 'ACCESS_UPDATED' ? copy.activityAccessUpdated : entry.action === 'ACCESS_REVOKED' ? copy.activityAccessRevoked : copy.activityUnknown;
          const locationEvent = entry.action === 'MOVED' || ['UPLOADED', 'FILE_TRASHED', 'FILE_RESTORED', 'CREATED'].includes(entry.action);
          const detail = entry.detail ? locationEvent ? `${copy.location}: ${entry.detail === 'ROOT' ? copy.myDrive : entry.detail}` : entry.action === 'RENAMED' ? `${copy.fileName}: ${entry.detail}` : entry.action.startsWith('ACCESS_') ? `${copy.accessRole}: ${entry.detail === 'READER' ? copy.shareReader : entry.detail === 'EDITOR' ? copy.shareEditor : entry.detail}` : entry.detail : '';
          return <article key={entry.id} className="grid grid-cols-[2rem_1fr] gap-3 text-xs"><span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-accent-soft font-semibold text-accent">{entry.actorName.slice(0, 1).toUpperCase()}</span><div><p className="font-medium">{entry.actorName} · {action}{detail ? ` · ${detail}` : ''}</p><time className="mt-1 block text-muted" dateTime={entry.createdAt}>{new Intl.DateTimeFormat(copy.socialLocale.replace('_', '-'), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.createdAt))}</time></div></article>;
        })}</section> : <div role="tabpanel">
          {selectedFile && <div className="grid aspect-[4/3] place-items-center overflow-hidden border-b border-line bg-raised text-5xl text-accent">{isImage(selectedFile) && canPreview(selectedFile) ? <img src={previewUrl(selectedFile)} alt={selectedFile.name} className="size-full object-contain" /> : isVideo(selectedFile) && canPreview(selectedFile) ? <video src={previewUrl(selectedFile)} controls playsInline aria-label={selectedFile.name} className="max-h-full max-w-full" /> : isPdf(selectedFile) && canPreview(selectedFile) ? <iframe src={previewUrl(selectedFile)} title={selectedFile.name} className="size-full bg-white" /> : <span aria-hidden="true">▤</span>}</div>}
          <section className="grid gap-3 border-b border-line p-5"><h3 className="text-sm font-semibold">{copy.itemDescription}</h3><textarea aria-label={copy.itemDescription} value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} maxLength={1000} disabled={!!(selectedFile ? initialTrash || selectedFile.permission === 'READER' : folderDetails?.permission === 'READER')} placeholder={copy.noDescription} className="min-h-20 resize-y rounded-xl border border-line bg-raised p-3 text-xs text-ink placeholder:text-muted disabled:opacity-70" />{(selectedFile ? !initialTrash && selectedFile.permission !== 'READER' : folderDetails?.permission !== 'READER') && <button type="button" disabled={savingDescription} onClick={() => void saveDescription(selectedFile ? 'files' : 'folders', selectedFile?.id ?? folderDetails!.id)} className="min-h-10 justify-self-start rounded-full border border-line px-4 text-xs font-semibold text-accent disabled:opacity-50">{(selectedFile?.description ?? folderDetails?.description) ? copy.saveDescription : copy.addDescription}</button>}</section>
          <section className="border-b border-line p-5"><h3 className="mb-2 text-sm font-semibold">{copy.peopleWithAccess}</h3>{(selectedFile?.ownerId === userId || folderDetails?.ownerId === userId) ? <><ShareAccessList resourceId={selectedFile?.id ?? folderDetails!.id} kind={selectedFile ? 'files' : 'folders'} copy={copy} avatarOnly showHeading={false} onChanged={onChanged ?? (async () => undefined)} />{!initialTrash && <button type="button" onClick={() => selectedFile ? (setEditMode('share'), setEditing(selectedFile)) : setFolderAction({ folder: folderDetails!, action: 'share' })} className="min-h-10 justify-self-start rounded-full border border-line px-4 text-xs font-semibold text-accent">{copy.manageAccess}</button>}</> : user && <div className="group/avatar relative z-0 w-fit hover:z-20 focus-within:z-20"><span role="img" tabIndex={0} aria-label={user.name ?? user.email} aria-describedby={`current-profile-${selectedFile?.id ?? folderDetails?.id}`} className="grid size-9 cursor-default place-items-center overflow-hidden rounded-full bg-accent-soft font-semibold text-accent">{user.pictureUrl ? <img src={user.pictureUrl} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : (user.name ?? user.email).slice(0, 1).toUpperCase()}</span><span id={`current-profile-${selectedFile?.id ?? folderDetails?.id}`} role="tooltip" className="invisible absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-line bg-surface p-3 text-xs opacity-0 shadow-panel transition-opacity group-hover/avatar:visible group-hover/avatar:opacity-100 group-focus-within/avatar:visible group-focus-within/avatar:opacity-100"><span className="block truncate font-semibold text-ink">{user.name ?? user.username ?? user.email}</span>{user.username && <span className="mt-1 block text-muted">@{user.username}</span>}<span className="mt-1 block break-all text-muted">{user.email}</span></span></div>}</section>
          <dl className="grid gap-4 p-5 text-xs"><div><dt className="text-muted">{copy.fileType}</dt><dd className="mt-1 break-all">{selectedFile?.contentType ?? copy.folderType}</dd></div>{selectedFile && <div><dt className="text-muted">{copy.fileSize}</dt><dd className="mt-1">{formatFileSize(selectedFile.sizeBytes)}</dd></div>}<div><dt className="text-muted">{copy.fileStorageUsed}</dt><dd className="mt-1">{formatFileSize(selectedFile?.sizeBytes ?? folderDetails?.storageBytes ?? 0)}</dd></div><div><dt className="text-muted">{copy.location}</dt><dd className="mt-1"><button type="button" className="text-left text-accent underline" onClick={() => onNavigate(selectedFile?.folderId ?? folderDetails?.parentId ?? null)}>{selectedFile?.folderName ?? copy.myDrive}</button></dd></div><div><dt className="text-muted">{copy.filterOwner}</dt><dd className="mt-1">{selectedFile?.ownerName ?? (selectedFile?.ownerId === userId || folderDetails?.ownerId === userId ? copy.shareOwner : selectedFile?.permission ?? folderDetails?.permission)}</dd></div><div><dt className="text-muted">{copy.lastModified}</dt><dd className="mt-1">{new Intl.DateTimeFormat(copy.socialLocale.replace('_', '-'), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selectedFile?.updatedAt ?? folderDetails?.updatedAt ?? selectedFile?.createdAt ?? folderDetails!.createdAt))}</dd></div>{selectedFile && <div><dt className="text-muted">{copy.lastOpened}</dt><dd className="mt-1">{selectedFile.openedAt ? new Intl.DateTimeFormat(copy.socialLocale.replace('_', '-'), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selectedFile.openedAt)) : '—'}</dd></div>}<div><dt className="text-muted">{copy.createdDate}</dt><dd className="mt-1">{new Intl.DateTimeFormat(copy.socialLocale.replace('_', '-'), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selectedFile?.createdAt ?? folderDetails!.createdAt))}</dd></div></dl>
        </div>}
        </>}
      </aside>}
    </div>
    {folderAction && <FolderActionDialog key={`${folderAction.folder.id}-${folderAction.action}`} {...folderAction} copy={copy} onClose={() => setFolderAction(null)} onSaved={onChanged ?? (async () => undefined)} />}
    {viewing && <FileViewer file={viewing} copy={copy} apiUrl={apiUrl} onPrevious={viewingIndex > 0 ? () => setViewing(navigableFiles[viewingIndex - 1]) : undefined} onNext={viewingIndex >= 0 && viewingIndex < navigableFiles.length - 1 ? () => setViewing(navigableFiles[viewingIndex + 1]) : undefined} onClose={() => { setViewing(null); void onChanged?.(); }} onDelete={() => { setDeleting(viewing); setViewing(null); }} />}
    {editing && <FileEditDialog file={editing} mode={editMode} copy={copy} onClose={() => setEditing(null)} onSaved={onChanged ?? (async () => undefined)} />}
    {creating && onCreateFolder && <CreateFolderDialog copy={copy} onClose={() => setCreating(false)} onSubmit={(name) => onCreateFolder(name, currentFolderId)} />}
    {deleting && <dialog ref={deleteDialog} onCancel={() => setDeleting(null)} aria-labelledby="delete-title" className="fixed inset-0 m-auto w-[min(90vw,440px)] rounded-2xl border border-line bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/50">
      <h2 id="delete-title" className="mb-3 font-semibold">{initialTrash ? copy.confirmPermanentTitle : copy.deleteChoiceTitle}</h2><p className="mb-5 truncate text-sm text-muted">{deleting.name}</p><div className="grid gap-2">
        {!initialTrash && <button type="button" className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-white" onClick={() => { onMoveToTrash(deleting); setDeleting(null); setSelected(null); }}>{copy.trashChoice}</button>}
        {initialTrash && <><p className="text-sm leading-6 text-muted">{copy.emptyTrashDescription}</p><button type="button" className="min-h-11 rounded-xl border border-line text-sm text-status" onClick={() => { onDeletePermanent(deleting.id); setDeleting(null); setSelected(null); }}>{copy.deletePermanently}</button></>}
        <button type="button" className="min-h-10 text-sm text-muted" onClick={() => setDeleting(null)}>{copy.cancel}</button></div>
    </dialog>}
    {emptying && <dialog ref={emptyDialog} onCancel={(event) => { if (emptyBusy) event.preventDefault(); else setEmptying(false); }} aria-labelledby="empty-trash-title" className="fixed inset-0 m-auto w-[min(92vw,460px)] rounded-2xl border border-line bg-surface p-6 text-ink shadow-panel backdrop:bg-black/60">
      <h2 id="empty-trash-title" className="mb-4 text-lg font-semibold">{copy.emptyTrashAction}</h2><p className="mb-6 text-sm leading-6 text-muted">{copy.emptyTrashDescription}</p><div className="flex justify-end gap-2"><button type="button" disabled={emptyBusy} className="min-h-11 rounded-xl px-4 text-sm" onClick={() => setEmptying(false)}>{copy.cancel}</button><button type="button" disabled={emptyBusy} className="min-h-11 rounded-xl bg-status px-4 text-sm font-semibold text-white" onClick={() => { setEmptyBusy(true); void (async () => {
        try { const response = await authenticatedFetch('/api/files/trash', { method: 'DELETE' }); const result: unknown = await response.json(); if (!response.ok) throw new Error(); if (typeof result === 'object' && result !== null && 'pending' in result && typeof result.pending === 'number' && result.pending > 0) sileo.error({ title: copy.emptyTrashPending }); else sileo.success({ title: copy.filePermanentlyDeleted }); await onChanged?.(); setEmptying(false); } catch { sileo.error({ title: copy.fileActionFailed }); } finally { setEmptyBusy(false); }
      })(); }}>{copy.emptyTrashAction}</button></div>
    </dialog>}
  </section>;
}
