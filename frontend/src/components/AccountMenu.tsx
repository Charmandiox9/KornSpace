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
    <details className="group/account relative z-50 min-w-0">
      <summary className="grid min-h-16 min-w-0 cursor-pointer list-none grid-cols-[40px_minmax(0,1fr)_16px] items-center gap-2.5 rounded-[14px] border border-line bg-raised px-2.5 py-[9px] transition-colors hover:border-accent-line hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent group-open/account:border-accent-line group-open/account:bg-accent-soft [&::-webkit-details-marker]:hidden max-[760px]:flex max-[760px]:min-h-[54px] max-[760px]:justify-center max-[760px]:border-0 max-[760px]:bg-transparent max-[760px]:px-0 max-[760px]:py-[7px]" aria-label={copy.accountMenu}>
        <span className="grid size-[38px] place-items-center overflow-hidden rounded-full text-[13px] font-bold text-white [&_img]:size-full [&_img]:object-cover bg-linear-to-br from-accent to-secondary" aria-hidden="true">
          {user.pictureUrl
            ? <img src={user.pictureUrl} alt="" referrerPolicy="no-referrer" />
            : getProfileInitials(user)}
        </span>
        <span className="grid min-w-0 gap-1 max-[760px]:hidden">
          <span className="truncate text-xs font-semibold">@{user.username}</span>
          <span className="truncate text-[10px] text-muted">{user.email}</span>
        </span>
        <svg className="size-4 text-muted transition-transform duration-150 group-open/account:rotate-180 motion-reduce:transition-none max-[760px]:hidden" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </summary>
      <div className="invisible absolute bottom-[calc(100%+10px)] left-0 z-50 grid w-full origin-bottom-left translate-y-1 gap-3 rounded-2xl border border-line bg-surface p-4 opacity-0 shadow-panel transition-[opacity,transform,visibility] duration-150 ease-out group-open/account:visible group-open/account:translate-y-0 group-open/account:opacity-100 motion-reduce:transform-none motion-reduce:transition-none max-[760px]:bottom-0 max-[760px]:left-[calc(100%+10px)] max-[760px]:w-[min(280px,calc(100vw-80px))] max-[760px]:origin-bottom-left">
        <div className="flex min-w-0 items-center gap-3 border-b border-line pb-3">
          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-bold text-white [&_img]:size-full [&_img]:object-cover bg-linear-to-br from-accent to-secondary" aria-hidden="true">{user.pictureUrl ? <img src={user.pictureUrl} alt="" referrerPolicy="no-referrer" /> : getProfileInitials(user)}</span>
          <div className="min-w-0"><p className="m-0 truncate text-sm font-semibold text-ink">{user.name ?? copy.profileNameUnavailable}</p><p className="m-0 mt-0.5 truncate text-xs text-muted">{user.email}</p><p className="m-0 mt-1 truncate text-[11px] font-medium text-accent">@{user.username}</p></div>
        </div>
        <div>
          <p className="m-0 mb-2 text-[10px] font-bold tracking-widest text-muted uppercase">{copy.appearanceControls}</p>
          <div className="grid gap-2 [&_button]:min-h-10 [&_button]:text-xs">
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
        </div>
        <button className="inline-flex cursor-pointer items-center gap-[7px] rounded-xl border border-line bg-surface text-xs font-semibold text-status transition-colors hover:border-status/40 hover:bg-status/5 [&_svg]:size-[17px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.7] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] min-h-10 w-full justify-start px-[13px]" type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); onLogout(); }}>
          <LogoutIcon />
          <span>{copy.logout}</span>
        </button>
      </div>
    </details>
  );
}
