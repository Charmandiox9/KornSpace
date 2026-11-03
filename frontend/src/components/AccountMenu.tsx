import type { AccountMenuProps, AuthenticatedUser } from '@/types';
import { ActionButton, LogoutIcon, MoonIcon, SunIcon } from './ActionButton';

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
    <details className="group/account relative min-w-0">
      <summary className="grid min-h-16 min-w-0 cursor-pointer list-none grid-cols-[40px_minmax(0,1fr)_16px] items-center gap-2.5 rounded-[14px] border border-line bg-raised px-2.5 py-[9px] transition-colors hover:border-accent-line hover:bg-accent-soft group-open/account:border-accent-line group-open/account:bg-accent-soft [&::-webkit-details-marker]:hidden max-[760px]:flex max-[760px]:min-h-[54px] max-[760px]:justify-center max-[760px]:border-0 max-[760px]:bg-transparent max-[760px]:px-0 max-[760px]:py-[7px]" aria-label={copy.accountMenu}>
        <span className="grid size-[38px] place-items-center overflow-hidden rounded-full text-[13px] font-bold text-white [&_img]:size-full [&_img]:object-cover bg-linear-to-br from-accent to-secondary" aria-hidden="true">
          {user.pictureUrl
            ? <img src={user.pictureUrl} alt="" referrerPolicy="no-referrer" />
            : getProfileInitials(user)}
        </span>
        <span className="grid min-w-0 gap-1 max-[760px]:hidden">
          <span className="truncate text-xs font-semibold">@{user.username}</span>
          <span className="truncate text-[10px] text-muted">{user.email}</span>
        </span>
        <span className="text-center text-lg text-muted transition-transform group-open/account:rotate-180 max-[760px]:hidden" aria-hidden="true">⌃</span>
      </summary>
      <div className="absolute bottom-[calc(100%+10px)] left-0 z-5 grid w-full gap-3 rounded-2xl border border-line bg-surface p-4 shadow-panel max-[760px]:w-[220px]">
        <p className="m-0 text-[10px] font-bold tracking-widest text-muted uppercase">{copy.accountDetails}</p>
        <dl className="m-0 grid gap-2.5 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-[3px] [&_dt]:text-[10px] [&_dt]:text-muted [&_dd]:m-0 [&_dd]:truncate [&_dd]:text-xs [&_dd]:font-semibold">
          <div><dt>{copy.profileName}</dt><dd>{user.name ?? copy.profileNameUnavailable}</dd></div>
          <div><dt>{copy.usernameLabel}</dt><dd>@{user.username}</dd></div>
          <div><dt>{copy.emailLabel}</dt><dd>{user.email}</dd></div>
        </dl>
        <div className="h-px bg-line" />
        <p className="m-0 text-[10px] font-bold tracking-widest text-muted uppercase">{copy.appearanceControls}</p>
        <div className="grid gap-[7px] [&_button]:min-h-10 [&_button]:text-xs max-[760px]:[&_button]:w-full max-[760px]:[&_button]:justify-start max-[760px]:[&_button]:px-[13px]">
          <ActionButton ariaLabel={languageActionLabel} onClick={onLanguageChange} title={languageActionLabel}>
            <span className="text-[11px] font-bold tracking-wider text-accent" aria-hidden="true">{nextLanguage.toUpperCase()}</span>
            <span>{nextLanguageName}</span>
          </ActionButton>
          <ActionButton
            ariaLabel={theme === 'light' ? copy.switchThemeToDark : copy.switchThemeToLight}
            onClick={onThemeChange}
            pressed={theme === 'dark'}
            title={theme === 'light' ? copy.switchThemeToDark : copy.switchThemeToLight}
          >
            <span className="grid size-[17px] place-items-center text-accent [&_svg]:size-[17px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.7] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">{theme === 'light' ? <MoonIcon /> : <SunIcon />}</span>
            <span>{theme === 'light' ? copy.darkTheme : copy.lightTheme}</span>
          </ActionButton>
        </div>
        <button className="inline-flex cursor-pointer items-center gap-[7px] rounded-[10px] border border-line bg-surface text-[11px] font-semibold hover:border-accent-line hover:bg-accent-soft [&_svg]:size-[17px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.7] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] min-h-10 w-full justify-start px-[13px] text-ink" type="button" onClick={onLogout}>
          <LogoutIcon />
          <span>{copy.logout}</span>
        </button>
      </div>
    </details>
  );
}
