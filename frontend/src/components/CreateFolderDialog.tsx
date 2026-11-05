'use client';

import type { CreateFolderDialogProps } from '@/types';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

const MAX_FOLDER_NAME_LENGTH = 255;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';

export function CreateFolderDialog({ copy, onClose, onSubmit }: CreateFolderDialogProps) {
  const titleId = useId();
  const inputId = useId();
  const errorId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Mueve el foco al campo al abrir y lo devuelve a quien abrió el diálogo al cerrar.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => opener?.focus();
  }, []);

  function validate(value: string): string {
    if (value.length === 0) return copy.folderNameRequired;
    if (value.length > MAX_FOLDER_NAME_LENGTH || /[\\/]/u.test(value)) return copy.folderNameInvalid;
    return '';
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSaving) return;
    const trimmed = name.trim();
    const problem = validate(trimmed);
    setError(problem);
    if (problem) {
      inputRef.current?.focus();
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : copy.folderCreateFailed);
      setIsSaving(false);
      inputRef.current?.focus();
    }
  }

  // Escape cierra y Tab no sale del diálogo.
  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!isSaving) onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-80 grid place-items-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose(); }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl max-[420px]:p-4"
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="mb-4 text-lg font-semibold">{copy.newFolder}</h2>
        <form className="grid gap-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-1.5">
            <label className="text-xs font-semibold text-muted" htmlFor={inputId}>{copy.folderNameLabel}</label>
            <input
              ref={inputRef}
              id={inputId}
              className="min-h-11 w-full rounded-xl border border-line bg-raised px-3 text-sm text-ink"
              type="text"
              autoComplete="off"
              value={name}
              maxLength={MAX_FOLDER_NAME_LENGTH + 1}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              disabled={isSaving}
              onChange={(event) => { setName(event.currentTarget.value); if (error) setError(''); }}
            />
            {error && <p id={errorId} className="m-0 text-xs font-semibold text-status" role="alert">{error}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="min-h-11 cursor-pointer rounded-xl px-4 text-sm text-muted hover:bg-raised" disabled={isSaving} onClick={onClose}>{copy.cancel}</button>
            <button type="submit" className="min-h-11 cursor-pointer rounded-xl border-0 bg-linear-to-br from-accent to-secondary px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70" disabled={isSaving}>{copy.createFolder}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
