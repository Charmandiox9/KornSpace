import { useEffect, useMemo, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import type { LibraryPageProps, LibrarySnapshot } from '@/types';
import { readLibraryQuery } from './is-folder-contents';
import { FilesPage } from './FilesPage';
import { FILE_LIBRARY_QUERY } from '@/graphql/operations';
import { toUserMessage } from '@/lib/user-facing-error';
import { useProcessingPoll } from '@/hooks/use-processing-poll';

export function LibraryPage({ sharedOnly = false, refreshKey = 0, ...props }: LibraryPageProps) {
  const { copy } = props;
  const [snapshot, setSnapshot] = useState<LibrarySnapshot>({ all: [], recent: [], folders: [] });
  const { all, recent, folders } = snapshot;
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [owner, setOwner] = useState('');
  const [modified, setModified] = useState('');
  const [location, setLocation] = useState('');
  const hasLoadedLibrary = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    if (!hasLoadedLibrary.current) setBusy(true);
    setError('');
    void (async () => {
      try {
        const response = await authenticatedFetch('/graphql', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: FILE_LIBRARY_QUERY, variables: { shared: sharedOnly } }) });
        const payload: unknown = await response.json();
        const result = readLibraryQuery(payload);
        if (!response.ok || !result) throw new Error();
        if (!controller.signal.aborted) setSnapshot(result);
      } catch (caught: unknown) { if (!controller.signal.aborted) setError(toUserMessage(caught, copy.loadError, copy.networkError)); }
      finally { if (!controller.signal.aborted) { hasLoadedLibrary.current = true; setBusy(false); } }
    })();
    return () => controller.abort();
  }, [sharedOnly, refreshKey, copy.loadError, copy.networkError]);
  useProcessingPoll(all, () => props.onChanged?.());

  const available = useMemo(() => [...new Map([...all, ...recent].map((file) => [file.id, file])).values()], [all, recent]);
  const owners = new Map(available.filter((file) => file.ownerId).map((file) => [file.ownerId!, file.ownerName ?? file.ownerId!]));
  const locations = new Map(available.filter((file) => file.folderId).map((file) => [file.folderId!, file.folderName ?? file.folderId!]));
  const files = (sharedOnly ? all : recent).filter((file) => {
    const type = file.contentType.split(';')[0];
    return file.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())
      && (!kind || (kind === 'document' ? /^application\/(pdf|json|xml|msword|rtf|vnd\.(openxmlformats-officedocument|ms-|oasis))/.test(type) : type.startsWith(`${kind}/`)))
      && (!owner || file.ownerId === owner)
      && (!location || (location === 'root' ? !file.folderId : file.folderId === location))
      && (!modified || new Date(file.updatedAt ?? file.createdAt).getTime() >= Date.now() - Number(modified) * 86400000);
  });
  const suggestedFolderIds = new Set(recent.map((file) => file.folderId));
  const suggestedFolders = [...folders].sort((a, b) => Number(suggestedFolderIds.has(b.id)) - Number(suggestedFolderIds.has(a.id)) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  const selectClass = 'min-h-10 max-w-full cursor-pointer rounded-lg border border-line bg-surface px-3 text-[13px] text-ink transition-colors duration-150 hover:border-accent-line focus-visible:outline-accent';
  const toolbar = <div className="mb-3 grid gap-4 border-b border-line pb-4">
    <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-muted transition-colors duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15"><svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label={copy.searchFiles} placeholder={copy.searchFiles} className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus-visible:outline-none" /></label>
    <div className="flex flex-wrap gap-2">
      <select aria-label={copy.filterType} className={selectClass} value={kind} onChange={(event) => setKind(event.target.value)}><option value="">{copy.filterType}: {copy.filterAll}</option>{[['image', copy.filterImages], ['video', copy.filterVideos], ['audio', copy.filterAudio], ['text', copy.filterText], ['document', copy.filterDocuments]].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select aria-label={copy.filterOwner} className={selectClass} value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">{copy.filterOwner}: {copy.filterAll}</option>{[...owners].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select aria-label={copy.filterModified} className={selectClass} value={modified} onChange={(event) => setModified(event.target.value)}><option value="">{copy.filterModified}: {copy.filterAll}</option><option value="7">{copy.filterWeek}</option><option value="30">{copy.filterMonth}</option></select>
      <select aria-label={copy.filterLocation} className={selectClass} value={location} onChange={(event) => setLocation(event.target.value)}><option value="">{copy.filterLocation}: {copy.filterAll}</option><option value="root">{copy.myDrive}</option>{[...locations].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
    </div>
  </div>;
  return <FilesPage {...props} collapsibleSections={!sharedOnly} foldersLabel={!sharedOnly ? copy.suggestedFolders : undefined} filesLabel={!sharedOnly ? copy.suggestedFiles : undefined} showQuickAccess={!sharedOnly} files={files} folders={search || kind || owner || modified || location ? [] : sharedOnly ? folders.filter((folder) => folder.ownerId !== props.userId) : suggestedFolders} currentFolder={null} currentFolderId={null} breadcrumbs={[]} title={sharedOnly ? copy.sharedWithMe : copy.homeWelcome} toolbar={toolbar} isLoading={busy} notice={error || props.notice} />;
}
