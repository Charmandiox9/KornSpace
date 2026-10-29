import { GoogleIcon } from '../components/ActionButton';
import { PublicLayout } from '../components/PublicLayout';
import type { TranslationCatalog } from '../i18n';
import type { Language, Theme } from '../i18n';

interface LoginPageProps {
  copy: TranslationCatalog;
  language: Language;
  theme: Theme;
  notice: string;
  apiUrl: (path: string) => string;
  onLanguageChange: () => void;
  onThemeChange: () => void;
}

export function LoginPage({
  copy,
  language,
  theme,
  notice,
  apiUrl,
  onLanguageChange,
  onThemeChange,
}: LoginPageProps) {
  return (
    <PublicLayout
      copy={copy}
      language={language}
      theme={theme}
      onLanguageChange={onLanguageChange}
      onThemeChange={onThemeChange}
    >
      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="login-title">{copy.loginTitle}</h1>
        <p className="intro">{copy.loginDescription}</p>
        {notice && <p className="notice" role="alert">{notice}</p>}
        <a className="google-login-button" href={apiUrl('/api/auth/google')}>
          <GoogleIcon />
          {copy.loginWithGoogle}
        </a>
      </section>
    </PublicLayout>
  );
}
