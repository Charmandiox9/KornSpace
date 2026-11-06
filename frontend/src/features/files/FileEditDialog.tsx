import { useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';
import { authenticatedFetch } from '@/lib/api-client';
import type { FileEditDialogProps, ResolvedShareRecipient } from '@/types';
import { isShareRecipient } from './is-share-recipient';

export function FileEditDialog({ file, mode, copy, onClose, onSaved }: FileEditDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(mode === 'rename' ? file.name : '');
  const [role, setRole] = useState('READER');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedShareRecipient | null>(null);
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'missing' | 'error' | 'ready'>('idle');
  const [lookupVersion, setLookupVersion] = useState(0);
  const matchingRecipient = resolved?.identifier === value.trim() ? resolved.recipient : null;
  useEffect(() => {
    if (mode !== 'share') return;
    const identifier = value.trim();
    setResolved(null);
    if (identifier.length < 3) { setLookupState('idle'); return; }
    setLookupState('loading');
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await authenticatedFetch(`/api/files/${encodeURIComponent(file.id)}/recipients?identifier=${encodeURIComponent(identifier)}`, { signal: controller.signal });
          if (controller.signal.aborted) return;
          if (response.status === 404) { setLookupState('missing'); return; }
          if (!response.ok) throw new Error();
          const payload: unknown = await response.json();
          if (!isShareRecipient(payload)) throw new Error();
          if (!controller.signal.aborted) { setResolved({ identifier, recipient: payload }); setLookupState('ready'); }
        } catch { if (!controller.signal.aborted) setLookupState('error'); }
      })();
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [file.id, mode, value, lookupVersion]);
  useEffect(() => { dialog.current?.showModal(); input.current?.focus(); if (mode === 'rename') input.current?.select(); }, [mode]);
  async function save() {
    if (busy) return;
    if (mode === 'share' && !matchingRecipient) return;
    if (mode === 'rename' && (!value.trim() || /[\\/\u0000-\u001f\u007f]/u.test(value))) { setError(copy.folderNameInvalid); return; }
    setBusy(true); setError('');
    try {
      const response = await authenticatedFetch(`/api/files/${encodeURIComponent(file.id)}${mode === 'share' ? '/permissions' : ''}`, {
        method: mode === 'share' ? 'PUT' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'share' ? { identifier: value.trim(), recipientId: matchingRecipient?.userId, role } : { name: value.trim(), ...(conflictId ? { replaceFileId: conflictId } : {}) }),
      });
      if (response.status === 409) {
        if (mode === 'share') { setError(copy.shareRecipientChanged); setResolved(null); setLookupVersion((version) => version + 1); return; }
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
      <label className="grid gap-2 text-xs text-muted">{mode === 'rename' ? copy.fileName : copy.shareEmail}<input ref={input} type="text" autoComplete="off" aria-describedby={mode === 'share' ? 'share-recipient-status' : undefined} required maxLength={255} disabled={busy} value={value} onChange={(event) => { setValue(event.target.value); setConflictId(null); setError(''); }} className="min-h-11 rounded-xl border border-line bg-raised px-3 text-sm text-ink" /></label>
      {mode === 'share' && <div id="share-recipient-status" role="status" aria-live="polite" className="text-xs text-muted">
        {matchingRecipient ? <div className="grid gap-1 rounded-xl border border-accent-line bg-accent-soft p-3"><span className="font-semibold text-ink">{matchingRecipient.username ? `@${matchingRecipient.username}` : matchingRecipient.name ?? matchingRecipient.email}</span><span className="break-all">{matchingRecipient.email}</span></div> : lookupState === 'loading' ? copy.shareSearching : lookupState === 'missing' ? copy.shareNotFound : lookupState === 'error' ? <span>{copy.shareLookupError} <button type="button" className="font-semibold text-accent underline" onClick={() => setLookupVersion((version) => version + 1)}>{copy.shareRetry}</button></span> : null}
      </div>}
      {mode === 'share' && <select aria-label={copy.shareFile} disabled={busy} value={role} onChange={(event) => setRole(event.target.value)} className="min-h-11 rounded-xl border border-line bg-raised px-3 text-sm"><option value="READER">{copy.shareReader}</option><option value="EDITOR">{copy.shareEditor}</option></select>}
      {conflictId && <p className="text-sm leading-6 text-muted">{copy.replaceDescription}</p>}
      {error && <p role="alert" className="text-sm text-status">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} className="min-h-11 rounded-xl px-4 text-sm hover:bg-raised" onClick={onClose}>{copy.cancel}</button><button type="submit" disabled={busy || (mode === 'share' && !matchingRecipient)} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">{conflictId ? copy.replaceFile : copy.saveChanges}</button></div>
    </form>
  </dialog>;
}
