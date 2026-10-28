import { ActionButton, LogoutIcon, MoonIcon, SunIcon } from './ActionButton';
import type { Language, Theme, TranslationCatalog } from '../i18n';
import type { AuthenticatedUser } from '../types';

interface AccountMenuProps {
  user: AuthenticatedUser;
  copy: TranslationCatalog;
  language: Language;
  theme: Theme;
  onLanguageChange: () => void;
  onThemeChange: () => void;
  onLogout: () => void;
}

function getProfileInitials(user: AuthenticatedUser): string {
  const words = user.name?.trim().split(/\s+/u).filter(Boolean) ?? [];
  return words.length > 0
    ? words.slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase()
    : user.email.charAt(0).toUpperCase();
}

export function AccountMenu({
  user,
  copy,
  language,
  theme,
  onLanguageChange,
  onThemeChange,
  onLogout,
}: AccountMenuProps) {
  const nextLanguage = language === 'es' ? 'en' : 'es';
  const nextLanguageName = nextLanguage === 'en' ? copy.languageEnglish : copy.languageSpanish;
  const languageActionLabel = nextLanguage === 'en'
    ? copy.switchLanguageToEnglish
    : copy.switchLanguageToSpanish;

  return (
    <details className="account-menu">
      <summary className="sidebar-account-trigger" aria-label={copy.accountMenu}>
        <span className="profile-avatar" aria-hidden="true">
          {user.pictureUrl
            ? <img src={user.pictureUrl} alt="" referrerPolicy="no-referrer" />
            : getProfileInitials(user)}
        </span>
        <span className="profile-details">
          <span className="profile-name">@{user.username}</span>
          <span className="profile-email">{user.email}</span>
        </span>
        <span className="account-menu-chevron" aria-hidden="true">⌃</span>
      </summary>
      <div className="account-menu-panel">
        <p className="account-menu-title">{copy.accountDetails}</p>
        <dl className="account-details-list">
          <div><dt>{copy.profileName}</dt><dd>{user.name ?? copy.profileNameUnavailable}</dd></div>
          <div><dt>{copy.usernameLabel}</dt><dd>@{user.username}</dd></div>
          <div><dt>{copy.emailLabel}</dt><dd>{user.email}</dd></div>
        </dl>
        <div className="account-menu-divider" />
        <p className="account-menu-title">{copy.appearanceControls}</p>
        <div className="account-menu-actions">
          <ActionButton ariaLabel={languageActionLabel} onClick={onLanguageChange} title={languageActionLabel}>
            <span className="language-code" aria-hidden="true">{nextLanguage.toUpperCase()}</span>
            <span>{nextLanguageName}</span>
          </ActionButton>
          <ActionButton
            ariaLabel={theme === 'light' ? copy.switchThemeToDark : copy.switchThemeToLight}
            onClick={onThemeChange}
            pressed={theme === 'dark'}
            title={theme === 'light' ? copy.switchThemeToDark : copy.switchThemeToLight}
          >
            <span className="theme-icon">{theme === 'light' ? <MoonIcon /> : <SunIcon />}</span>
            <span>{theme === 'light' ? copy.darkTheme : copy.lightTheme}</span>
          </ActionButton>
        </div>
        <button className="logout-button account-menu-logout" type="button" onClick={onLogout}>
          <LogoutIcon />
          <span>{copy.logout}</span>
        </button>
      </div>
    </details>
  );
}
