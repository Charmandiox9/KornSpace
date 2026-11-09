import { createPortal } from 'react-dom';
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { sileo } from 'sileo';
import type { ItemColor, ItemOrganizeMenuProps, ItemOrganizationPatch } from '@/types';
import { itemColors } from './item-organization';
import { ActionIcon } from './ActionIcon';

interface SubmenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  side: 'left' | 'right';
}

export function ItemOrganizeMenu({ preference, copy, onUpdate }: ItemOrganizeMenuProps) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<SubmenuPosition | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const submenuId = useId();

  useEffect(() => setPortalReady(true), []);
  useLayoutEffect(() => {
    const anchor = trigger.current;
    const menu = panel.current;
    if (!open || !anchor || !menu) return;

    function place() {
      if (!anchor || !menu) return;
      const anchorRect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const width = Math.min(232, viewportWidth - 24);
      const gap = 4;
      const side = anchorRect.right + gap + width <= viewportWidth - 8 ? 'right' : 'left';
      const rawLeft = side === 'right' ? anchorRect.right + gap : anchorRect.left - width - gap;
      const left = Math.max(8, Math.min(rawLeft, viewportWidth - width - 8));
      const maxHeight = Math.max(120, viewportHeight - 16);
      const panelHeight = Math.min(menu.scrollHeight || 320, maxHeight);
      const top = Math.max(8, Math.min(anchorRect.top, viewportHeight - panelHeight - 8));
      setPosition({ left, top, width, maxHeight, side });
    }

    place();
    const observer = new ResizeObserver(place);
    observer.observe(menu);
    document.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      document.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [open, portalReady]);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  function cancelClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    trigger.current?.focus();
  }

  async function update(patch: ItemOrganizationPatch) {
    if (busy) return;
    setBusy(true);
    try {
      await onUpdate(patch);
    } catch {
      sileo.error({ title: copy.organizationError });
    } finally {
      setBusy(false);
    }
  }

  const submenu = open && portalReady && createPortal(
    <div
      ref={panel}
      id={submenuId}
      data-organize-submenu
      data-side={position?.side ?? 'right'}
      role="group"
      aria-label={copy.organize}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
      onFocus={cancelClose}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose(); }}
      onKeyDown={handleKeyDown}
      style={{ position: 'fixed', left: position?.left ?? 0, top: position?.top ?? 0, width: position?.width ?? 232, maxHeight: position?.maxHeight ?? 'calc(100vh - 16px)' }}
      className="z-[110] grid content-start gap-1 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-2 text-xs text-ink shadow-panel"
    >
      <button type="button" disabled={busy} aria-pressed={preference?.starred ?? false} onClick={() => void update({ starred: !preference?.starred })} className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-left hover:bg-raised disabled:opacity-50"><ActionIcon name="star" />{preference?.starred ? copy.unstarItem : copy.starItem}</button>
      <button type="button" disabled={busy} aria-pressed={preference?.shortcut ?? false} onClick={() => void update({ shortcut: !preference?.shortcut })} className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-left hover:bg-raised disabled:opacity-50"><ActionIcon name="shortcut" />{preference?.shortcut ? copy.unpinItem : copy.pinItem}</button>
      <fieldset className="grid grid-cols-5 gap-2 px-3 py-2"><legend className="py-2 text-xs text-muted">{copy.itemColor}</legend>{(Object.keys(itemColors) as ItemColor[]).map((color) => <button key={color} type="button" disabled={busy} aria-label={`${copy.itemColor}: ${color === 'DEFAULT' ? copy.defaultColor : copy.colorNames[color]}`} aria-pressed={(preference?.color ?? 'DEFAULT') === color} onClick={() => void update({ color })} className="grid size-8 place-items-center rounded-full border border-line aria-pressed:ring-2 aria-pressed:ring-accent aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface disabled:opacity-50" style={{ backgroundColor: itemColors[color] }}><span className="sr-only">{color === 'DEFAULT' ? copy.defaultColor : copy.colorNames[color]}</span></button>)}</fieldset>
    </div>,
    document.body,
  );

  return <div className="border-y border-line py-1" onMouseEnter={() => { cancelClose(); setOpen(true); }} onMouseLeave={scheduleClose} onClick={(event) => { if (!panel.current?.contains(event.target as Node)) event.stopPropagation(); }}>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={submenuId} aria-haspopup="true" onFocus={() => setOpen(true)} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>('button')?.focus()); } }} onClick={(event) => { event.stopPropagation(); setOpen(true); }} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-raised"><ActionIcon name="organize" /><span className="flex-1">{copy.organize}</span><span aria-hidden="true" className="text-muted">›</span></button>
    {submenu}
  </div>;
}
