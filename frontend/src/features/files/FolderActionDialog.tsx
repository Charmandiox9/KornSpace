import { useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';
import { authenticatedFetch } from '@/lib/api-client';
import type { FolderActionDialogProps, FolderEditor } from '@/types';

export function FolderActionDialog({ folder, action, copy, onClose, onSaved }: FolderActionDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(action === 'rename' ? folder.name : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editors, setEditors] = useState<FolderEditor[]>([]);
  const [version, setVersion] = useState(0);
  const [loadingEditors, setLoadingEditors] = useState(action === 'share');
  useEffect(() => {
    if (action !== 'share') return;
    const controller = new AbortController();
    setLoadingEditors(true);
    void (async () => {
      try {
        const response = await authenticatedFetch(`/api/folders/${encodeURIComponent(folder.id)}/editors`, { signal: controller.signal });
        const payload: unknown = await response.json();
        if (!response.ok || !Array.isArray(payload) || !payload.every((item: unknown) => typeof item === 'object' && item !== null && 'userId' in item && typeof item.userId === 'string' && 'email' in item && typeof item.email === 'string' && 'username' in item && (item.username === null || typeof item.username === 'string'))) throw new Error();
        setEditors(payload as FolderEditor[]);
      } catch { if (!controller.signal.aborted) setError(copy.folderActionFailed); }
      finally { if (!controller.signal.aborted) setLoadingEditors(false); }
    })();
    return () => controller.abort();
  }, [action, folder.id, version, copy.folderActionFailed]);
  async function revoke(userId: string) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await authenticatedFetch(`/api/folders/${encodeURIComponent(folder.id)}/editors/${encodeURIComponent(userId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setEditors((previous) => previous.filter((editor) => editor.userId !== userId));
      sileo.success({ title: copy.folderActionSuccess });
    } catch { setError(copy.folderActionFailed); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    return () => { opener?.focus(); };
  }, []);
  const title = action === 'rename' ? copy.renameFolder : action === 'delete' ? copy.deleteFolder : copy.shareFolder;
  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await authenticatedFetch(`/api/folders/${encodeURIComponent(folder.id)}${action === 'share' ? '/editors' : ''}`, {
        method: action === 'delete' ? 'DELETE' : action === 'share' ? 'PUT' : 'PATCH',
        ...(action === 'delete' ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'share' ? { identifier: value.trim() } : { name: value.trim() }) }),
      });
      if (!response.ok) throw new Error(response.status === 409 ? action === 'delete' ? copy.folderNotEmpty : copy.folderNameConflict : response.status === 400 ? copy.folderNameInvalid : response.status === 404 ? copy.folderParentMissing : copy.folderActionFailed);
      sileo.success({ title: copy.folderActionSuccess });
      await onSaved();
      if (action === 'share') { setValue(''); setVersion((previous) => previous + 1); } else onClose();
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : copy.folderActionFailed); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="folder-action-title" aria-describedby="folder-action-description" onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }} className="fixed inset-0 m-auto w-[min(92vw,460px)] rounded-2xl border border-line bg-surface p-6 text-ink shadow-panel backdrop:bg-black/60">
    <h2 id="folder-action-title" className="mb-4 text-lg font-semibold">{title}</h2>
    <p className="mb-4 break-all text-sm">{folder.name}</p>
    <p id="folder-action-description" className="mb-4 text-sm text-muted">{action === 'delete' ? copy.folderDeletePolicy : action === 'share' ? copy.folderEditorHint : copy.folderNameLabel}</p>
    {action === 'share' && <section aria-label={copy.folderEditors} aria-busy={loadingEditors} className="mb-4 grid gap-2">{editors.map((editor) => <div key={editor.userId} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 break-all">{editor.username ? `@${editor.username} · ` : ''}{editor.email}</span><button type="button" disabled={busy || loadingEditors} onClick={() => void revoke(editor.userId)} className="min-h-11 shrink-0 rounded-lg px-2 text-status">{copy.revokeFolderEditor}</button></div>)}</section>}
    <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="grid gap-4">
      {action !== 'delete' && <label className="grid gap-2 text-sm">{action === 'share' ? copy.shareEmail : copy.folderNameLabel}<input autoFocus required maxLength={255} disabled={busy} value={value} onChange={(event) => setValue(event.target.value)} className="min-h-11 rounded-xl border border-line bg-raised px-3 text-ink" /></label>}
      {error && <p role="alert" className="text-sm text-status">{error}</p>}
      <div className="flex justify-end gap-2"><button autoFocus={action === 'delete'} type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-xl px-4">{copy.cancel}</button><button disabled={busy} type="submit" className="min-h-11 rounded-xl bg-accent px-4 text-white disabled:opacity-50">{title}</button></div>
    </form>
  </dialog>;
}
