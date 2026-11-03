import type { AppearanceControlsProps } from '@/types';
import { ActionButton, MoonIcon, SunIcon } from './ActionButton';

export function AppearanceControls({
  copy,
  language,
  theme,
  onLanguageChange,
  onThemeChange,
}: AppearanceControlsProps) {
  const nextLanguage = language === 'es' ? 'en' : 'es';
  const nextLanguageName = nextLanguage === 'en' ? copy.languageEnglish : copy.languageSpanish;
  const languageActionLabel = nextLanguage === 'en'
    ? copy.switchLanguageToEnglish
    : copy.switchLanguageToSpanish;

  return (
    <div className="flex gap-2 [&_button]:w-auto max-[760px]:[&_button]:w-12 max-[760px]:[&_button]:justify-center max-[760px]:[&_button]:px-0 max-[760px]:[&_button>span:last-child]:hidden" aria-label={copy.appearanceControls}>
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
  );
}
