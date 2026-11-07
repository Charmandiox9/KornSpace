import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
export function useAppMotion(root: RefObject<HTMLElement | null>, route: string, enabled: boolean) {
  const keyboard = useRef(false);
  useEffect(() => {
    const markKeyboard = () => { keyboard.current = true; document.documentElement.dataset.input = 'keyboard'; };
    const markPointer = () => { keyboard.current = false; document.documentElement.dataset.input = 'pointer'; };
    document.addEventListener('keydown', markKeyboard, true); document.addEventListener('pointerdown', markPointer, true);
    return () => { document.removeEventListener('keydown', markKeyboard, true); document.removeEventListener('pointerdown', markPointer, true); };
  }, []);
  useEffect(() => {
    const host = root.current;
    if (!enabled || !host) return;
    const ease = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim() || 'cubic-bezier(0.23, 1, 0.32, 1)';
    const animations = new Set<Animation>();
    const latest = new WeakMap<HTMLElement, Animation>();
    const opening = new WeakSet<HTMLElement>();
    function play(element: HTMLElement, keyframes: Keyframe[], duration: number, delay = 0) {
      latest.get(element)?.cancel();
      const animation = element.animate(keyframes, { duration, delay, easing: ease });
      animations.add(animation); latest.set(element, animation);
      animation.finished.then(() => animations.delete(animation)).catch(() => animations.delete(animation));
    }
    if (!keyboard.current) host.querySelectorAll<HTMLElement>('#workspace-title, #login-title, #username-title, [data-motion-enter]').forEach((element, index) => play(element, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], 240, Math.min(index, 4) * 32));
    const toggle = (event: Event) => {
      if (keyboard.current || !(event.target instanceof HTMLDetailsElement) || !event.target.open) return;
      const panel = event.target.querySelector<HTMLElement>(':scope > summary + div');
      if (panel) { panel.style.transformOrigin = 'top right'; play(panel, [{ opacity: 0.5, transform: 'translateY(-4px) scale(.97)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], 160); }
    };
    const press = (event: PointerEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>('button, a') : null;
      if (!button || button.matches(':disabled') || button.closest('[data-sileo-viewport]')) return;
      const transform = getComputedStyle(button).transform;
      play(button, [{ transform: transform === 'none' ? 'scale(.98)' : transform }, { transform: 'scale(1)' }], 160);
    };
    const observer = new MutationObserver(() => {
      host.querySelectorAll<HTMLDialogElement>('dialog').forEach((dialog) => {
        if (!dialog.open) { opening.delete(dialog); return; }
        if (opening.has(dialog)) return;
        opening.add(dialog);
        if (!keyboard.current) play(dialog, [{ opacity: 0 }, { opacity: 1 }], 200);
      });
    });
    observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    host.addEventListener('toggle', toggle, true); host.addEventListener('pointerdown', press);
    return () => { observer.disconnect(); host.removeEventListener('toggle', toggle, true); host.removeEventListener('pointerdown', press); animations.forEach((animation) => animation.cancel()); };
  }, [root, route, enabled]);
}
