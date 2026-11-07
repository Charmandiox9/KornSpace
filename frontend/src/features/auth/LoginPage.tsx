import { LoginMascotScene } from './LoginMascotScene';
import type { LoginPageProps } from '@/types';
import { GoogleIcon } from '@/components/ActionButton';
import { PublicLayout } from '@/components/PublicLayout';

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
      wide
      copy={copy}
      language={language}
      theme={theme}
      onLanguageChange={onLanguageChange}
      onThemeChange={onThemeChange}
    >
      <div className="grid w-full grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)] items-center gap-[clamp(24px,4vw,72px)] self-center max-[900px]:grid-cols-1 max-[900px]:gap-8">
      <LoginMascotScene copy={copy} theme={theme} />
      <section data-motion-enter className="relative flex w-full max-w-[440px] self-center flex-col items-start rounded-2xl border border-line bg-surface px-[clamp(24px,3vw,44px)] py-[clamp(36px,4vw,56px)] text-left justify-self-center" aria-labelledby="login-title">
        <h1 className="m-0 text-[clamp(30px,3vw,42px)] font-semibold tracking-[-0.035em] leading-[1.12]" id="login-title">{copy.loginTitle}</h1>
        <p className="mt-[21px] max-w-[410px] text-[15px] leading-[1.75] text-muted">{copy.loginDescription}</p>
        {notice && <p className="m-0 rounded-xl border border-line bg-raised px-4 py-3.5 text-[13px] leading-[1.6] text-muted mb-3" role="alert">{notice}</p>}
        <a className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-accent-line bg-accent-soft px-5 text-sm font-semibold text-ink no-underline transition-[transform,background-color,border-color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px hover:border-accent hover:bg-raised motion-reduce:transform-none motion-reduce:transition-none" href={apiUrl('/api/auth/google')}>
          <GoogleIcon />
          {copy.loginWithGoogle}
        </a>
      </section>
      </div>
    </PublicLayout>
  );
}
