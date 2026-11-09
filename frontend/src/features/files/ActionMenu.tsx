import { useLayoutEffect, useRef, useState } from 'react';
import type { ActionMenuProps } from '@/types';
import { placeActionMenu } from '@/lib/menu-placement';

export function ActionMenu({ label, children, onSelect, onDismiss }: ActionMenuProps) {
  const details = useRef<HTMLDetailsElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const summary = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const dismiss = useRef(onDismiss); dismiss.current = onDismiss;
  useLayoutEffect(() => {
    const menu = panel.current, trigger = summary.current, container = details.current;
    if (!open || !menu || !trigger || !container) return;
    document.querySelectorAll<HTMLDetailsElement>('[data-action-menu][open]').forEach((other) => { if (other !== container) other.open = false; });
    menu.showPopover();
    function position() {
      if (!menu || !trigger) return;
      const viewport = window.visualViewport;
      const width = Math.min(240, (viewport?.width ?? innerWidth) - 24);
      menu.style.width = `${width}px`;
      const placement = placeActionMenu(trigger.getBoundingClientRect(), menu.scrollHeight + 2, width, viewport?.width ?? innerWidth, viewport?.height ?? innerHeight);
      menu.style.left = `${placement.left}px`; menu.style.top = `${placement.top}px`; menu.style.maxHeight = `${placement.maxHeight}px`;
      menu.dataset.direction = placement.direction;
    }
    position();
    const observer = new ResizeObserver(position); observer.observe(menu);
    const contents = new MutationObserver(position); contents.observe(menu, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    const outside = (event: PointerEvent) => { if (event.target instanceof Element && event.target.closest('[data-organize-submenu]')) return; if (event.target instanceof Node && !container.contains(event.target)) { container.open = false; dismiss.current(); } };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (event.target instanceof Element && event.target.closest('[data-organize-submenu]')) return; event.preventDefault(); container.open = false; trigger.focus(); dismiss.current(); } };
    const scroll = (event: Event) => { if (event.target instanceof Node && menu.contains(event.target)) return; position(); };
    document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', escape, true);
    document.addEventListener('scroll', scroll, true); window.addEventListener('resize', position); window.visualViewport?.addEventListener('resize', position);
    return () => { observer.disconnect(); contents.disconnect(); if (menu.matches(':popover-open')) menu.hidePopover(); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true); document.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', position); window.visualViewport?.removeEventListener('resize', position); };
  }, [open]);
  return <details data-action-menu ref={details} className="relative mr-2 shrink-0" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary ref={summary} aria-label={label} title={label} onClick={() => { if (!details.current?.open) onSelect(); else onDismiss(); }} className="grid size-10 cursor-pointer list-none place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-accent-soft hover:text-accent"><svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg></summary>
    <div ref={panel} popover="manual" className="fixed inset-auto m-0 w-60 gap-1 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-2 text-[13px] leading-5 text-ink shadow-panel [scrollbar-width:thin] [&:popover-open]:grid" onClick={() => { if (details.current) details.current.open = false; onDismiss(); }}>{children}</div>
  </details>;
}
