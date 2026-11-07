import { RoosterMark } from '@/components/RoosterMark';
import type { UsernameSetupPageProps } from '@/types';

export function UsernameSetupPage({
  copy,
  username,
  notice,
  isSaving,
  onUsernameChange,
  onSubmit,
}: UsernameSetupPageProps) {
  return (
    <section data-motion-enter className="relative flex w-full max-w-[520px] self-center flex-col items-center overflow-hidden rounded-[20px] border border-line bg-surface px-[clamp(22px,7vw,64px)] py-[clamp(34px,7vw,68px)] text-center shadow-panel justify-self-center before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-linear-to-r before:from-accent before:to-secondary" aria-labelledby="username-title">
      <span className="mb-5 block size-12 text-accent" aria-hidden="true"><RoosterMark /></span>
      <h1 className="m-0 max-w-[500px] text-[clamp(34px,6vw,50px)] font-semibold tracking-[-0.045em] leading-[1.08]" id="username-title">{copy.usernameTitle}</h1>
      <p className="mt-[21px] max-w-[410px] text-[15px] leading-[1.75] text-muted">{copy.usernameDescription}</p>
      <form className="mt-[25px] grid w-full max-w-[360px] gap-2.5 text-left [&_label]:text-[13px] [&_label]:font-semibold" onSubmit={onSubmit}>
        <label htmlFor="username">{copy.usernameLabel}</label>
        <div className="flex min-h-[50px] items-center gap-[9px] rounded-xl border border-line bg-raised px-3.5 text-muted focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15 [&_input]:w-full [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-ink [&_input]:outline-none">
          <span aria-hidden="true">@</span>
          <input
            id="username"
            name="username"
            autoComplete="username"
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_]+"
            required
            value={username}
            onChange={(event) => onUsernameChange(event.currentTarget.value)}
            placeholder={copy.usernamePlaceholder}
          />
        </div>
        <p className="m-0 text-[11px] text-muted">{copy.usernameHint}</p>
        {notice && <p className="m-0 rounded-xl border border-line bg-raised px-4 py-3.5 text-[13px] leading-[1.6] text-muted mb-3" role="alert">{notice}</p>}
        <button className="mt-[9px] inline-flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-3 rounded-xl px-[22px] text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70 bg-linear-to-br from-accent to-secondary" type="submit" disabled={isSaving}>
          {isSaving ? copy.usernameSaving : copy.usernameContinue}
        </button>
      </form>
    </section>
  );
}
