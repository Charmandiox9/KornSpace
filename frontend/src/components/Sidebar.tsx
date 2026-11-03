import type { SidebarProps } from '@/types';
import { AccountMenu } from './AccountMenu';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar(props: SidebarProps) {
  const { copy } = props;
  const pathname = usePathname() ?? '/files';
  return (
    <aside className="sticky top-0 flex min-h-svh self-start flex-col gap-[34px] border-r border-line/85 bg-surface/90 px-[18px] pt-7 pb-5 backdrop-blur-lg max-[760px]:items-center max-[760px]:gap-7 max-[760px]:px-2.5 max-[760px]:pt-5 max-[760px]:pb-4 max-[420px]:px-[7px]" aria-label={copy.account}>
      <Link className="inline-flex shrink-0 items-center gap-[11px] text-ink no-underline" href="/files" aria-label="KornSpace">
        <span className="grid size-[38px] place-items-center rounded-[11px] text-lg font-bold text-white shadow-md shadow-accent/25 max-[760px]:size-[42px] max-[420px]:size-[38px] bg-linear-to-br from-accent to-secondary" aria-hidden="true">K</span>
        <span className="text-[15px] font-semibold tracking-tight max-[760px]:hidden">KornSpace</span>
      </Link>
      <nav className="grid w-full gap-1" aria-label={copy.workspaceNavigation}>
        <Link href="/files" aria-current={pathname === '/files' ? 'page' : undefined} className={`rounded-xl px-3 py-2.5 text-sm font-semibold no-underline transition-colors max-[760px]:px-2 ${pathname === '/files' ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-raised hover:text-ink'}`}>
          <span className="max-[760px]:sr-only">{copy.myDrive}</span><span className="hidden max-[760px]:inline" aria-hidden="true">⌂</span>
        </Link>
        <Link href="/trash" aria-current={pathname === '/trash' ? 'page' : undefined} className={`rounded-xl px-3 py-2.5 text-sm font-semibold no-underline transition-colors max-[760px]:px-2 ${pathname === '/trash' ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-raised hover:text-ink'}`}>
          <span className="max-[760px]:sr-only">{copy.trashHeading}</span><span className="hidden max-[760px]:inline" aria-hidden="true">▱</span>
        </Link>
      </nav>
      <div className="flex-1" />
      <div className="mt-auto grid w-full gap-3">
        <AccountMenu {...props} />
        <p className="m-0 border-t border-line/85 px-2.5 pt-3.5 text-[11px] text-muted max-[760px]:hidden">KornSpace</p>
      </div>
    </aside>
  );
}
