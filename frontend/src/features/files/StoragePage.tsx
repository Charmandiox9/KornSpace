import { useEffect, useState } from 'react';
import type { FilesPageProps, StorageUsage } from '@/types';
import { authenticatedFetch } from '@/lib/api-client';
import { formatFileSize } from '@/lib/format-file-size';
import { isStoredFile } from './is-stored-file';
import { FilesPage } from './FilesPage';

export function StoragePage(props: FilesPageProps) {
  const [usage, setUsage] = useState<StorageUsage>({ totalBytes: 0, trashBytes: 0, files: [] });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError('');
    void (async () => {
      try {
        const response = await authenticatedFetch('/graphql', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query { storageUsage { totalBytes trashBytes files { id name contentType sizeBytes status checksum createdAt updatedAt deletedAt ownerId ownerName folderId folderName permission openedAt } } }' }) });
        const payload: unknown = await response.json();
        if (!response.ok || typeof payload !== 'object' || payload === null || !('data' in payload) || typeof payload.data !== 'object' || payload.data === null || !('storageUsage' in payload.data)) throw new Error();
        const value = payload.data.storageUsage;
        if (typeof value !== 'object' || value === null || !('totalBytes' in value) || typeof value.totalBytes !== 'number' || !('trashBytes' in value) || typeof value.trashBytes !== 'number' || !('files' in value) || !Array.isArray(value.files) || !value.files.every(isStoredFile)) throw new Error();
        if (!controller.signal.aborted) setUsage({ totalBytes: value.totalBytes, trashBytes: value.trashBytes, files: value.files });
      } catch { if (!controller.signal.aborted) setError(props.copy.loadError); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    })();
    return () => controller.abort();
  }, [props.files, props.trash, props.copy.loadError]);
  const toolbar = <div className="mb-4 border-b border-line py-5"><p className="text-sm text-muted">{props.copy.storageTotal}</p><p data-storage-total className="mt-2 text-3xl font-semibold tabular-nums">{busy ? '—' : formatFileSize(usage.totalBytes)}</p><p className="mt-3 text-xs text-muted">{props.copy.storageScope}</p><p className="mt-2 text-xs text-muted">{props.copy.inTrash}: {formatFileSize(usage.trashBytes)}</p></div>;
  return <FilesPage {...props} files={usage.files} folders={[]} currentFolder={null} currentFolderId={null} breadcrumbs={[]} title={props.copy.storageHeading} toolbar={toolbar} listView initialSortOrder="sizeDesc" isLoading={busy} notice={error || props.notice} />;
}
