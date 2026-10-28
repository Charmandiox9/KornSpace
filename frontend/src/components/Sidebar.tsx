import { AccountMenu } from './AccountMenu';
import type { Language, Theme, TranslationCatalog } from '../i18n';
import type { AuthenticatedUser } from '../types';

interface SidebarProps {
  user: AuthenticatedUser;
  copy: TranslationCatalog;
  language: Language;
  theme: Theme;
  onLanguageChange: () => void;
  onThemeChange: () => void;
  onLogout: () => void;
}

export function Sidebar(props: SidebarProps) {
  const { copy } = props;
  return (
    <aside className="sidebar" aria-label={copy.account}>
      <a className="brand" href="/files" aria-label="KornSpace">
        <span className="brand-mark" aria-hidden="true">K</span>
        <span className="brand-name">KornSpace</span>
      </a>
      <div className="sidebar-spacer" />
      <div className="sidebar-bottom">
        <AccountMenu {...props} />
        <p className="sidebar-caption">KornSpace</p>
      </div>
    </aside>
  );
}
