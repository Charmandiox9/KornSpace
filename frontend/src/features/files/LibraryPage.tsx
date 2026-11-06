import { useEffect, useMemo, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import type { LibraryPageProps, StoredFile } from '@/types';
import { isStoredFile } from './is-stored-file';
import { FilesPage } from './FilesPage';

function isLibraryFile(value: unknown): value is StoredFile {
  return isStoredFile(value) && typeof value.updatedAt === 'string' && typeof value.ownerName === 'string'
    && (typeof value.ownerId === 'string' || value.ownerId === null)
    && (typeof value.folderId === 'string' || value.folderId === null)
    && (typeof value.folderName === 'string' || value.folderName === null)
    && (typeof value.openedAt === 'string' || value.openedAt === null)
    && (value.permission === 'OWNER' || value.permission === 'READER' || value.permission === 'EDITOR');
}

const fields = 'id name contentType sizeBytes status checksum createdAt updatedAt deletedAt ownerId ownerName folderId folderName permission openedAt';

export function LibraryPage({ sharedOnly = false, refreshKey = 0, ...props }: LibraryPageProps) {
  const { copy } = props;
  const [all, setAll] = useState<StoredFile[]>([]);
  const [recent, setRecent] = useState<StoredFile[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [owner, setOwner] = useState('');
  const [modified, setModified] = useState('');
  const [location, setLocation] = useState('');
  const [showRecent, setShowRecent] = useState(!sharedOnly);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError('');
    void (async () => {
      try {
        const response = await authenticatedFetch('/graphql', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `query { all: fileLibrary(filters: { shared: ${sharedOnly} }) { ${fields} } recent: fileLibrary(filters: { recent: true, shared: ${sharedOnly} }) { ${fields} } }` }) });
        const payload: unknown = await response.json();
        if (!response.ok || typeof payload !== 'object' || payload === null || !('data' in payload) || typeof payload.data !== 'object' || payload.data === null) throw new Error();
        const data = payload.data as Record<string, unknown>;
        if (!Array.isArray(data.all) || !data.all.every(isLibraryFile) || !Array.isArray(data.recent) || !data.recent.every(isLibraryFile)) throw new Error();
        if (!controller.signal.aborted) { setAll(data.all); setRecent(data.recent); }
      } catch { if (!controller.signal.aborted) setError(copy.loadError); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    })();
    return () => controller.abort();
  }, [sharedOnly, refreshKey, copy.loadError]);

  const available = useMemo(() => [...new Map([...all, ...recent].map((file) => [file.id, file])).values()], [all, recent]);
  const owners = new Map(available.filter((file) => file.ownerId).map((file) => [file.ownerId!, file.ownerName ?? file.ownerId!]));
  const locations = new Map(available.filter((file) => file.folderId).map((file) => [file.folderId!, file.folderName ?? file.folderId!]));
  const files = (showRecent ? recent : all).filter((file) => {
    const type = file.contentType.split(';')[0];
    return file.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())
      && (!kind || (kind === 'document' ? /^application\/(pdf|json|xml|msword|rtf|vnd\.(openxmlformats-officedocument|ms-|oasis))/.test(type) : type.startsWith(`${kind}/`)))
      && (!owner || file.ownerId === owner)
      && (!location || (location === 'root' ? !file.folderId : file.folderId === location))
      && (!modified || new Date(file.updatedAt ?? file.createdAt).getTime() >= Date.now() - Number(modified) * 86400000);
  });
  const selectClass = 'min-h-10 max-w-full rounded-full border border-line bg-raised px-4 text-xs text-ink focus-visible:outline-accent';
  const toolbar = <div className="mb-7 grid gap-5 border-b border-line pb-7">
    <label className="flex items-center gap-3 rounded-2xl border border-line bg-raised px-5 py-3 text-muted"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label={copy.searchFiles} placeholder={copy.searchFiles} className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" /></label>
    <div className="flex flex-wrap gap-2">
      <select aria-label={copy.filterType} className={selectClass} value={kind} onChange={(event) => setKind(event.target.value)}><option value="">{copy.filterType}: {copy.filterAll}</option>{[['image', copy.filterImages], ['video', copy.filterVideos], ['audio', copy.filterAudio], ['text', copy.filterText], ['document', copy.filterDocuments]].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select aria-label={copy.filterOwner} className={selectClass} value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">{copy.filterOwner}: {copy.filterAll}</option>{[...owners].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select aria-label={copy.filterModified} className={selectClass} value={modified} onChange={(event) => setModified(event.target.value)}><option value="">{copy.filterModified}: {copy.filterAll}</option><option value="7">{copy.filterWeek}</option><option value="30">{copy.filterMonth}</option></select>
      <select aria-label={copy.filterLocation} className={selectClass} value={location} onChange={(event) => setLocation(event.target.value)}><option value="">{copy.filterLocation}: {copy.filterAll}</option><option value="root">{copy.myDrive}</option>{[...locations].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
    </div>
    <div className="flex gap-2"><button type="button" aria-pressed={showRecent} className={`rounded-lg px-4 py-2 text-xs font-semibold ${showRecent ? 'bg-accent-soft text-accent' : 'text-muted'}`} onClick={() => setShowRecent(true)}>{copy.recentFiles}</button><button type="button" aria-pressed={!showRecent} className={`rounded-lg px-4 py-2 text-xs font-semibold ${!showRecent ? 'bg-accent-soft text-accent' : 'text-muted'}`} onClick={() => setShowRecent(false)}>{copy.allFiles}</button></div>
  </div>;
  return <FilesPage {...props} files={files} folders={search || kind || owner || modified || location || sharedOnly ? [] : props.folders} currentFolder={null} currentFolderId={null} breadcrumbs={[]} title={sharedOnly ? copy.sharedWithMe : copy.homeWelcome} toolbar={toolbar} isLoading={busy} notice={error || props.notice} />;
}
