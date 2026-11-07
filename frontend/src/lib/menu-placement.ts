import type { MenuAnchor, MenuPlacement } from '../types/workspace';
export function placeActionMenu(anchor: MenuAnchor, height: number, width: number, viewportWidth: number, viewportHeight: number): MenuPlacement {
  const edge = 12, gap = 6;
  const below = Math.max(0, viewportHeight - edge - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - edge - gap);
  const direction = height <= below || below >= above ? 'down' : 'up';
  const maxHeight = Math.min(height, direction === 'up' ? above : below);
  return { direction, maxHeight, left: Math.max(edge, Math.min(anchor.right - width, viewportWidth - width - edge)), top: Math.max(edge, Math.min(direction === 'up' ? anchor.top - gap - maxHeight : anchor.bottom + gap, viewportHeight - edge - maxHeight)) };
}
