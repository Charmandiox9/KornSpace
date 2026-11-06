import { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import type { ResourcePermission, ShareAccessListProps } from '@/types';

function isPermission(value: unknown): value is ResourcePermission {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.userId === 'string' && typeof row.email === 'string' && (row.username === null || typeof row.username === 'string') && (row.role === 'READER' || row.role === 'EDITOR') && typeof row.inherited === 'boolean' && typeof row.sourceId === 'string' && typeof row.sourceName === 'string';
}
export function ShareAccessList({ resourceId, kind, copy, refreshKey = 0, onChanged }: ShareAccessListProps) {
  const [rows, setRows] = useState<ResourcePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const path = `/api/${kind}/${encodeURIComponent(resourceId)}/permissions`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void (async () => {
      try {
        const response = await authenticatedFetch(path, { signal: controller.signal });
        const payload: unknown = await response.json();
        if (!response.ok || !Array.isArray(payload) || !payload.every(isPermission)) throw new Error();
        if (!controller.signal.aborted) setRows(payload);
      } catch { if (!controller.signal.aborted) setError(copy.fileActionFailed); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [path, refreshKey, version, copy.fileActionFailed]);
  async function update(row: ResourcePermission, role: string | null) {
    if (busy || row.inherited) return;
    setBusy(true); setError('');
    try {
      const response = await authenticatedFetch(`${path}/${encodeURIComponent(row.userId)}`, { method: role ? 'PATCH' : 'DELETE', ...(role ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) } : {}) });
      if (!response.ok) throw new Error();
      await onChanged(); setVersion((value) => value + 1);
    } catch { setError(copy.fileActionFailed); }
    finally { setBusy(false); }
  }
  return <section aria-label={copy.sharedPeople} aria-busy={loading} className="my-4 grid max-h-64 gap-3 overflow-y-auto">
    <h3 className="text-sm font-semibold">{copy.sharedPeople}</h3>
    {loading ? <p role="status" className="text-xs text-muted">{copy.loadingFiles}</p> : rows.length === 0 && <p className="text-xs text-muted">{copy.noSharedPeople}</p>}
    {rows.map((row) => <div key={`${row.sourceId}-${row.userId}`} className="grid gap-2 rounded-xl border border-line p-3 text-xs">
      <p className="break-all">{row.username ? `@${row.username} · ` : ''}{row.email}</p>
      <div className="flex flex-wrap items-center gap-2"><select aria-label={`${copy.accessRole}: ${row.email}`} value={row.role} disabled={busy || loading || row.inherited} onChange={(event) => void update(row, event.target.value)} className="min-h-10 rounded-lg border border-line bg-raised px-2"><option value="READER">{copy.shareReader}</option><option value="EDITOR">{copy.shareEditor}</option></select>
      {!row.inherited && <button type="button" disabled={busy || loading} className="min-h-10 rounded-lg px-2 text-status" onClick={() => void update(row, null)}>{copy.revokeFolderEditor}</button>}</div>
      {row.inherited && <p className="text-muted">{copy.inheritedAccess}: {row.sourceName}. <a href={`/files?folderId=${encodeURIComponent(row.sourceId)}`} className="text-accent underline">{copy.manageInheritedAccess}</a></p>}
    </div>)}
    {error && <p role="alert" className="text-xs text-status">{error} <button type="button" className="underline" onClick={() => setVersion((value) => value + 1)}>{copy.shareRetry}</button></p>}
  </section>;
}
