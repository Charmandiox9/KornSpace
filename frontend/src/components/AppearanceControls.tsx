import { ActionButton, MoonIcon, SunIcon } from './ActionButton';
import type { TranslationCatalog } from '../i18n';
import type { Language, Theme } from '../i18n';

interface AppearanceControlsProps {
  copy: TranslationCatalog;
  language: Language;
  theme: Theme;
  onLanguageChange: () => void;
  onThemeChange: () => void;
}

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
    <div className="public-controls" aria-label={copy.appearanceControls}>
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
  );
}
