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
      copy={copy}
      language={language}
      theme={theme}
      onLanguageChange={onLanguageChange}
      onThemeChange={onThemeChange}
    >
      <section className="relative flex w-full max-w-[620px] self-center flex-col items-center overflow-hidden rounded-[20px] border border-line bg-surface px-[clamp(22px,7vw,64px)] py-[clamp(34px,7vw,68px)] text-center shadow-panel justify-self-center before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-linear-to-r before:from-accent before:to-secondary" aria-labelledby="login-title">
        <p className="m-0 mb-5 text-[10px] font-bold tracking-[0.14em] text-accent uppercase">{copy.eyebrow}</p>
        <h1 className="m-0 max-w-[500px] text-[clamp(34px,6vw,50px)] font-semibold tracking-[-0.045em] leading-[1.08]" id="login-title">{copy.loginTitle}</h1>
        <p className="mt-[21px] max-w-[410px] text-[15px] leading-[1.75] text-muted">{copy.loginDescription}</p>
        {notice && <p className="m-0 rounded-xl border border-line bg-raised px-4 py-3.5 text-[13px] leading-[1.6] text-muted mb-3" role="alert">{notice}</p>}
        <a className="mt-[30px] inline-flex min-h-[50px] items-center justify-center gap-3 rounded-xl border border-line bg-surface px-[22px] text-sm font-semibold text-ink no-underline shadow-md transition duration-150 hover:-translate-y-px hover:border-accent-line hover:bg-accent-soft motion-reduce:transition-none" href={apiUrl('/api/auth/google')}>
          <GoogleIcon />
          {copy.loginWithGoogle}
        </a>
      </section>
    </PublicLayout>
  );
}
