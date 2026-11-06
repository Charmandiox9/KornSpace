import { useEffect, useRef, useState } from 'react';
import { ShareAccessList } from './ShareAccessList';
import { sileo } from 'sileo';
import { authenticatedFetch } from '@/lib/api-client';
import type { FolderActionDialogProps } from '@/types';

export function FolderActionDialog({ folder, action, copy, onClose, onSaved }: FolderActionDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(action === 'rename' ? folder.name : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState('READER');
  const [version, setVersion] = useState(0);
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
      const response = await authenticatedFetch(`/api/folders/${encodeURIComponent(folder.id)}${action === 'share' ? '/permissions' : ''}`, {
        method: action === 'delete' ? 'DELETE' : action === 'share' ? 'PUT' : 'PATCH',
        ...(action === 'delete' ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'share' ? { identifier: value.trim(), role } : { name: value.trim() }) }),
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
    {action === 'share' && <ShareAccessList resourceId={folder.id} kind="folders" copy={copy} refreshKey={version} onChanged={onSaved} />}
    <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="grid gap-4">
      {action !== 'delete' && <label className="grid gap-2 text-sm">{action === 'share' ? copy.shareEmail : copy.folderNameLabel}<input autoFocus required maxLength={255} disabled={busy} value={value} onChange={(event) => setValue(event.target.value)} className="min-h-11 rounded-xl border border-line bg-raised px-3 text-ink" /></label>}
      {action === 'share' && <select aria-label={copy.accessRole} value={role} disabled={busy} onChange={(event) => setRole(event.target.value)} className="min-h-11 rounded-xl border border-line bg-raised px-3"><option value="READER">{copy.shareReader}</option><option value="EDITOR">{copy.shareEditor}</option></select>}
      {error && <p role="alert" className="text-sm text-status">{error}</p>}
      <div className="flex justify-end gap-2"><button autoFocus={action === 'delete'} type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-xl px-4">{copy.cancel}</button><button disabled={busy} type="submit" className="min-h-11 rounded-xl bg-accent px-4 text-white disabled:opacity-50">{title}</button></div>
    </form>
  </dialog>;
}
