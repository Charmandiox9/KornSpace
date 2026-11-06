import type { ItemColor, SortOrder, SortableResource } from '../../types';
export const itemColors: Record<ItemColor, string> = { DEFAULT: 'var(--accent)', VIOLET: 'light-dark(#7546b8, #a78bfa)', BLUE: 'light-dark(#2463b3, #60a5fa)', GREEN: 'light-dark(#237a43, #4ade80)', YELLOW: 'light-dark(#936a00, #facc15)', ORANGE: 'light-dark(#b8540b, #fb923c)', RED: 'light-dark(#c13e3e, #f87171)', PINK: 'light-dark(#b53e78, #f472b6)', GRAY: 'light-dark(#596579, #94a3b8)' };
export function sortResources<T extends SortableResource>(items: T[], order: SortOrder): T[] {
  return [...items].sort((a, b) => {
    let result = 0;
    if (order.startsWith('name')) result = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    else if (order.startsWith('size')) result = (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0);
    else result = Date.parse(a.updatedAt ?? a.createdAt) - Date.parse(b.updatedAt ?? b.createdAt);
    if (order.endsWith('Desc')) result *= -1;
    return result || a.name.localeCompare(b.name);
  });
}
