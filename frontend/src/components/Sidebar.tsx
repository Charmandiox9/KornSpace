import type { ReactNode } from 'react';
import type { SidebarProps } from '@/types';
import { AccountMenu } from './AccountMenu';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const iconClass = 'size-5 shrink-0 fill-none stroke-current stroke-[1.8]';

function HomeIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 12.5a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9L18 7" />
      <path d="M9 7V4.5h6V7" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.3a3.2 3.2 0 0 1 0 5.9M18 14.4c1.8.7 3 2.4 3 5.1" />
    </svg>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function Sidebar(props: SidebarProps) {
  const { copy } = props;
  const pathname = usePathname() ?? '/files';

  // Solo destinos con vista propia: cada href tiene su ruta en app/(workspace).
  const navItems: NavItem[] = [
    { href: '/files', label: copy.myDrive, icon: <HomeIcon /> },
    { href: '/shared', label: copy.sharedWithMe, icon: <UsersIcon /> },
    { href: '/trash', label: copy.trashHeading, icon: <TrashIcon /> },
  ];

  return (
    <aside className="sticky top-0 flex min-h-svh self-start flex-col gap-[34px] border-r border-line/85 bg-surface/90 px-[18px] pt-7 pb-5 backdrop-blur-lg max-[760px]:items-center max-[760px]:gap-7 max-[760px]:px-2.5 max-[760px]:pt-5 max-[760px]:pb-4 max-[420px]:px-[7px]" aria-label={copy.sidebarLabel}>
      <Link className={`inline-flex shrink-0 items-center gap-[11px] rounded-xl text-ink no-underline ${focusRing}`} href="/files" aria-label="KornSpace">
        <span className="grid size-[38px] place-items-center rounded-[11px] text-lg font-bold text-white shadow-md shadow-accent/25 max-[760px]:size-[42px] max-[420px]:size-[38px] bg-linear-to-br from-accent to-secondary" aria-hidden="true">K</span>
        <span className="text-[15px] font-semibold tracking-tight max-[760px]:hidden">KornSpace</span>
      </Link>
      <div id="workspace-create-actions" className="relative z-50 w-full" />
      <nav className="grid w-full gap-1" aria-label={copy.workspaceNavigation}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold no-underline transition-colors max-[760px]:justify-center max-[760px]:px-2 ${focusRing} ${isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-raised hover:text-ink'}`}
            >
              {item.icon}
              <span className="max-[760px]:sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      <div className="mt-auto grid w-full gap-3">
        <AccountMenu {...props} />
        <p className="m-0 border-t border-line/85 px-2.5 pt-3.5 text-[11px] text-muted max-[760px]:hidden">KornSpace</p>
      </div>
    </aside>
  );
}

