import type { FormEvent } from 'react';
import type { TranslationCatalog } from '../i18n';

interface UsernameSetupPageProps {
  copy: TranslationCatalog;
  username: string;
  notice: string;
  isSaving: boolean;
  onUsernameChange: (username: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function UsernameSetupPage({
  copy,
  username,
  notice,
  isSaving,
  onUsernameChange,
  onSubmit,
}: UsernameSetupPageProps) {
  return (
    <section className="login-card username-card" aria-labelledby="username-title">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 id="username-title">{copy.usernameTitle}</h1>
      <p className="intro">{copy.usernameDescription}</p>
      <form className="username-form" onSubmit={onSubmit}>
        <label htmlFor="username">{copy.usernameLabel}</label>
        <div className="username-input-wrap">
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
        <p className="username-hint">{copy.usernameHint}</p>
        {notice && <p className="notice" role="alert">{notice}</p>}
        <button className="google-login-button username-submit" type="submit" disabled={isSaving}>
          {isSaving ? copy.usernameSaving : copy.usernameContinue}
        </button>
      </form>
    </section>
  );
}
