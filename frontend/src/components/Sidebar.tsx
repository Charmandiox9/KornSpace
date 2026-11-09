import { RoosterMark } from './RoosterMark';
import type { SidebarProps, WorkspaceNavItem } from '@/types';
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

function DriveIcon() {
  return <svg data-drive-icon className={iconClass} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h14l3 12v4H2v-4L5 4Z" /><path d="M2 16h20M6 19h.01M9 19h.01M7 8h10" /></svg>;
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

function StarIcon() { return <svg className={iconClass} viewBox="0 0 24 24" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>; }
function StorageIcon() { return <svg className={iconClass} viewBox="0 0 24 24" strokeLinejoin="round" aria-hidden="true"><path d="M7 19a5 5 0 1 1 0-10 6 6 0 0 1 11.5-1 5.5 5.5 0 0 1-.5 11H7Z" /></svg>; }

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function Sidebar(props: SidebarProps) {
  const { copy } = props;
  const pathname = usePathname() ?? '/files';

  // Solo destinos con vista propia: cada href tiene su ruta en app/(workspace).
  const navItems: WorkspaceNavItem[] = [
    { href: '/home', label: copy.home, icon: <HomeIcon /> },
    { href: '/files', label: copy.myDrive, icon: <DriveIcon /> },
    { href: '/shared', label: copy.sharedWithMe, icon: <UsersIcon /> },
    { href: '/starred', label: copy.starredItems, icon: <StarIcon /> },
    { href: '/trash', label: copy.trashHeading, icon: <TrashIcon /> },
    { href: '/storage', label: copy.storageHeading, icon: <StorageIcon /> },
  ];

  return (
    <aside className="sticky top-0 flex h-svh min-h-0 self-start flex-col gap-[34px] border-r border-line/85 bg-surface px-[18px] pt-7 pb-5 max-[760px]:items-center max-[760px]:gap-7 max-[760px]:px-2.5 max-[760px]:pt-5 max-[760px]:pb-4 max-[420px]:px-[7px]" aria-label={copy.sidebarLabel}>
      <Link className={`inline-flex shrink-0 items-center gap-[11px] rounded-xl text-ink no-underline ${focusRing}`} href="/home" aria-label="KornSpace">
        <span className="grid size-[38px] place-items-center rounded-[11px] text-lg font-bold text-white shadow-md shadow-accent/25 max-[760px]:size-[42px] max-[420px]:size-[38px] bg-linear-to-br from-accent to-secondary" aria-hidden="true"><span className="size-8"><RoosterMark /></span></span>
        <span className="text-[15px] font-semibold tracking-tight max-[760px]:hidden">KornSpace</span>
      </Link>
      <div id="workspace-create-actions" className="relative z-50 w-full" />
      <nav className="grid min-h-0 w-full flex-1 content-start gap-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]" aria-label={copy.workspaceNavigation}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              onClick={(event) => {
                if (item.href === '/files' && props.onDriveRoot && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); props.onDriveRoot(); }
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium no-underline transition-colors duration-150 max-[760px]:justify-center max-[760px]:px-2 ${focusRing} ${isActive ? 'bg-accent-soft font-semibold text-accent ring-1 ring-inset ring-accent-line' : 'text-muted hover:bg-raised hover:text-ink'}`}
            >
              {item.icon}
              <span className="max-[760px]:sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto grid w-full gap-3">
        <AccountMenu {...props} />
        <p className="m-0 border-t border-line/85 px-2.5 pt-3.5 text-[11px] text-muted max-[760px]:hidden">KornSpace</p>
      </div>
    </aside>
  );
}

