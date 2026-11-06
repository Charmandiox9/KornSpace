import { useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';
import { authenticatedFetch } from '@/lib/api-client';
import type { FileEditDialogProps } from '@/types';

export function FileEditDialog({ file, mode, copy, onClose, onSaved }: FileEditDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(mode === 'rename' ? file.name : '');
  const [role, setRole] = useState('READER');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflictId, setConflictId] = useState<string | null>(null);
  useEffect(() => { dialog.current?.showModal(); input.current?.focus(); if (mode === 'rename') input.current?.select(); }, [mode]);
  async function save() {
    if (busy) return;
    if (mode === 'rename' && (!value.trim() || /[\\/\u0000-\u001f\u007f]/u.test(value))) { setError(copy.folderNameInvalid); return; }
    setBusy(true); setError('');
    try {
      const response = await authenticatedFetch(`/api/files/${encodeURIComponent(file.id)}${mode === 'share' ? '/permissions' : ''}`, {
        method: mode === 'share' ? 'PUT' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'share' ? { email: value.trim(), role } : { name: value.trim(), ...(conflictId ? { replaceFileId: conflictId } : {}) }),
      });
      if (response.status === 409) {
        const payload: unknown = await response.json();
        if (typeof payload === 'object' && payload !== null && 'conflictId' in payload && typeof payload.conflictId === 'string') { setConflictId(payload.conflictId); return; }
      }
      if (!response.ok) throw new Error(copy.fileActionFailed);
      sileo.success({ title: mode === 'share' ? copy.shareSuccess : copy.renameSuccess });
      await onSaved(); onClose();
    } catch { setError(copy.fileActionFailed); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }} aria-labelledby="edit-file-title" className="fixed inset-0 m-auto w-[min(92vw,460px)] rounded-2xl border border-line bg-surface p-6 text-ink shadow-panel backdrop:bg-black/60">
    <h2 id="edit-file-title" className="mb-5 text-lg font-semibold">{conflictId ? copy.fileNameConflict : mode === 'rename' ? copy.renameFile : copy.shareFile}</h2>
    <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="grid gap-4">
      <label className="grid gap-2 text-xs text-muted">{mode === 'rename' ? copy.fileName : copy.shareEmail}<input ref={input} type={mode === 'share' ? 'email' : 'text'} required maxLength={255} disabled={busy} value={value} onChange={(event) => { setValue(event.target.value); setConflictId(null); }} className="min-h-11 rounded-xl border border-line bg-raised px-3 text-sm text-ink" /></label>
      {mode === 'share' && <select aria-label={copy.shareFile} disabled={busy} value={role} onChange={(event) => setRole(event.target.value)} className="min-h-11 rounded-xl border border-line bg-raised px-3 text-sm"><option value="READER">{copy.shareReader}</option><option value="EDITOR">{copy.shareEditor}</option></select>}
      {conflictId && <p className="text-sm leading-6 text-muted">{copy.replaceDescription}</p>}
      {error && <p role="alert" className="text-sm text-status">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} className="min-h-11 rounded-xl px-4 text-sm hover:bg-raised" onClick={onClose}>{copy.cancel}</button><button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">{conflictId ? copy.replaceFile : copy.saveChanges}</button></div>
    </form>
  </dialog>;
}
