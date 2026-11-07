import type { ActionIconProps } from '@/types';
const paths = {
  open: 'M9 5h10v10M19 5 8 16M5 9v10h10',
  rename: 'm14 5 5 5M4 20l4-1L20 7l-4-4L4 15z',
  share: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M20 8v6M17 11h6',
  organize: 'M3 7h7l2-3h8v16H3zM3 10h17',
  info: 'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z',
  shortcut: 'M9 5h12v14H9M3 12h11m-4-4 4 4-4 4',
};
export function ActionIcon({ name }: ActionIconProps) {
  return <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
