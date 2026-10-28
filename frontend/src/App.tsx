import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  getInitialLanguage,
  getInitialTheme,
  getNextLanguage,
  getNextTheme,
  translations,
  type Language,
  type Theme,
} from './i18n';

const languageStorageKey = 'kornspace-language';
const themeStorageKey = 'kornspace-theme';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/u, '');

function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

function apiCredentials(): RequestCredentials {
  return apiBaseUrl ? 'include' : 'same-origin';
}

interface StoredFile {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  status: 'PROCESSING' | 'AVAILABLE' | 'FAILED';
  checksum: string | null;
  createdAt: string;
}

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  pictureUrl: string | null;
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && typeof record.email === 'string'
    && (typeof record.name === 'string' || record.name === null)
    && (typeof record.username === 'string' || record.username === null)
    && (typeof record.pictureUrl === 'string' || record.pictureUrl === null);
}

async function authenticatedFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(apiUrl(input), { ...init, credentials: apiCredentials() });
  if (response.status !== 401) return response;
  const refreshResponse = await fetch(apiUrl('/api/auth/refresh'), {
    method: 'POST',
    credentials: apiCredentials(),
  });
  if (!refreshResponse.ok) return response;
  return fetch(apiUrl(input), { ...init, credentials: apiCredentials() });
}

function isStoredFile(value: unknown): value is StoredFile {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.contentType === 'string'
    && typeof record.sizeBytes === 'number'
    && (record.status === 'PROCESSING' || record.status === 'AVAILABLE' || record.status === 'FAILED')
    && (typeof record.checksum === 'string' || record.checksum === null)
    && typeof record.createdAt === 'string';
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getProfileInitials(user: AuthenticatedUser): string {
  const words = user.name?.trim().split(/\s+/u).filter(Boolean) ?? [];
  if (words.length > 0) {
    return words.slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase();
  }
  return user.email.charAt(0).toUpperCase();
}

function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The selected preference remains active for the current session.
  }
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.7 8.7 0 1 0 20.2 15.1Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3.7" />
      <path d="M12 2v2.1m0 15.8V22m10-10h-2.1M4.1 12H2m17.1-7.1-1.5 1.5M6.4 17.6l-1.5 1.5m14.2 0-1.5-1.5M6.4 6.4 4.9 4.9" />
    </svg>
  );
}

interface ActionButtonProps {
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  title: string;
}

function ActionButton({
  ariaLabel,
  children,
  onClick,
  pressed,
  title,
}: ActionButtonProps) {
  return (
    <button
      className="action-button"
      type="button"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() =>
    getInitialLanguage(readPreference(languageStorageKey), navigator.language),
  );
  const [theme, setTheme] = useState<Theme>(() =>
    getInitialTheme(
      readPreference(themeStorageKey),
      window.matchMedia('(prefers-color-scheme: dark)').matches,
    ),
  );
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'anonymous'>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [notice, setNotice] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copy = translations[language];
  const nextLanguage = getNextLanguage(language);
  const nextTheme = getNextTheme(theme);
  const nextLanguageName = nextLanguage === 'en'
    ? copy.languageEnglish
    : copy.languageSpanish;
  const languageActionLabel = nextLanguage === 'en'
    ? copy.switchLanguageToEnglish
    : copy.switchLanguageToSpanish;

  const refreshFiles = useCallback(async (): Promise<void> => {
    try {
      const response = await authenticatedFetch('/api/files');
      if (!response.ok) throw new Error(copy.loadError);
      const payload: unknown = await response.json();
      if (!Array.isArray(payload) || !payload.every(isStoredFile)) throw new Error(copy.loadError);
      setFiles(payload);
    } catch {
      setNotice(copy.loadError);
    }
  }, [copy.loadError]);

  useEffect(() => {
    let cancelled = false;
    const loginError = new URLSearchParams(window.location.search).get('loginError');
    if (loginError) {
      const messages: Record<string, string> = {
        google: copy.loginErrorGoogle,
        denied: copy.loginErrorGoogle,
        configuration: copy.loginErrorConfiguration,
        validation: copy.loginErrorValidation,
        provider: copy.loginErrorProvider,
        database: copy.loginErrorDatabase,
        server: copy.loginErrorServer,
      };
      setNotice(messages[loginError] ?? copy.loginErrorGoogle);
      window.history.replaceState({}, '', window.location.pathname);
    }
    void authenticatedFetch('/api/auth/me')
      .then(async (response) => {
        if (!response.ok) throw new Error(copy.loginFailure);
        const payload: unknown = await response.json();
        if (!isAuthenticatedUser(payload)) throw new Error(copy.loginFailure);
        if (!cancelled) {
          setUser(payload);
          setAuthStatus('authenticated');
        }
      })
      .catch(() => {
        if (!cancelled) setAuthStatus('anonymous');
      });
    return () => { cancelled = true; };
  }, [
    copy.loginErrorGoogle,
    copy.loginErrorConfiguration,
    copy.loginErrorValidation,
    copy.loginErrorProvider,
    copy.loginErrorDatabase,
    copy.loginErrorServer,
    copy.loginFailure,
  ]);

  async function logout(): Promise<void> {
    await authenticatedFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setFiles([]);
    setAuthStatus('anonymous');
  }

  async function saveUsername(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSavingUsername(true);
    setNotice('');
    try {
      const response = await authenticatedFetch('/api/auth/username', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (response.status === 409) throw new Error(copy.usernameTaken);
      if (!response.ok) throw new Error(copy.usernameSaveError);
      const payload: unknown = await response.json();
      if (!isAuthenticatedUser(payload)) throw new Error(copy.usernameSaveError);
      setUser(payload);
      setUsername('');
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : copy.usernameSaveError);
    } finally {
      setIsSavingUsername(false);
    }
  }

  useEffect(() => {
    if (authStatus === 'authenticated') void refreshFiles();
  }, [authStatus, refreshFiles]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !files.some((file) => file.status === 'PROCESSING')) return undefined;
    const timer = window.setInterval(() => void refreshFiles(), 2500);
    return () => window.clearInterval(timer);
  }, [authStatus, files, refreshFiles]);

  async function uploadSelectedFile(file: File | undefined): Promise<void> {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setNotice(copy.fileLimit);
      return;
    }
    setIsUploading(true);
    setNotice(copy.uploading);
    try {
      const response = await authenticatedFetch(`/api/files?name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!response.ok) throw new Error(copy.uploadError);
      const payload: unknown = await response.json();
      if (typeof payload !== 'object' || payload === null || !('file' in payload)) {
        throw new Error(copy.uploadError);
      }
      const result = payload as { file: unknown; asynchronous?: unknown };
      if (!isStoredFile(result.file) || typeof result.asynchronous !== 'boolean') {
        throw new Error(copy.uploadError);
      }
      setNotice(result.asynchronous ? copy.uploadQueued : copy.uploadSuccess);
      await refreshFiles();
    } catch {
      setNotice(copy.uploadError);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.title = copy.pageTitle;
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', copy.description);
    savePreference(languageStorageKey, language);
  }, [copy.pageTitle, language]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#111a15' : '#f2f5f1');
    savePreference(themeStorageKey, theme);
  }, [theme]);

  return (
    <div className={`app-shell${authStatus === 'authenticated' && user?.username ? '' : ' app-shell-public'}`}>
      {authStatus === 'authenticated' && user?.username && (
      <aside className="sidebar" aria-label={copy.appearanceControls}>
        <a className="brand" href="/" aria-label="KornSpace">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span className="brand-name">KornSpace</span>
        </a>

        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          {authStatus === 'authenticated' && user && (
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
                  <ActionButton
                    ariaLabel={languageActionLabel}
                    onClick={() => setLanguage(nextLanguage)}
                    title={languageActionLabel}
                  >
                    <span className="language-code" aria-hidden="true">{nextLanguage.toUpperCase()}</span>
                    <span>{nextLanguageName}</span>
                  </ActionButton>
                  <ActionButton
                    ariaLabel={theme === 'light' ? copy.switchThemeToDark : copy.switchThemeToLight}
                    onClick={() => setTheme(nextTheme)}
                    pressed={theme === 'dark'}
                    title={theme === 'light' ? copy.switchThemeToDark : copy.switchThemeToLight}
                  >
                    <span className="theme-icon">{theme === 'light' ? <MoonIcon /> : <SunIcon />}</span>
                    <span>{theme === 'light' ? copy.darkTheme : copy.lightTheme}</span>
                  </ActionButton>
                </div>
                <button
                  className="logout-button account-menu-logout"
                  type="button"
                  onClick={() => void logout()}
                >
                  <LogoutIcon />
                  <span>{copy.logout}</span>
                </button>
              </div>
            </details>
          )}
          <p className="sidebar-caption">KornSpace</p>
        </div>
      </aside>
      )}

      <main className="page">
        {authStatus === 'loading' ? (
          <section className="login-card" aria-live="polite"><p>{copy.loginChecking}</p></section>
        ) : authStatus === 'anonymous' ? (
          <div className="public-page">
            <header className="public-header">
              <a className="brand" href="/" aria-label="KornSpace">
                <span className="brand-mark" aria-hidden="true">K</span>
                <span className="brand-name">KornSpace</span>
              </a>
              <div className="public-controls">
                <ActionButton ariaLabel={languageActionLabel} onClick={() => setLanguage(nextLanguage)} title={languageActionLabel}>
                  <span className="language-code" aria-hidden="true">{nextLanguage.toUpperCase()}</span>
                  <span>{nextLanguageName}</span>
                </ActionButton>
                <ActionButton
                  ariaLabel={theme === 'light' ? copy.switchThemeToDark : copy.switchThemeToLight}
                  onClick={() => setTheme(nextTheme)}
                  pressed={theme === 'dark'}
                  title={theme === 'light' ? copy.switchThemeToDark : copy.switchThemeToLight}
                >
                  <span className="theme-icon">{theme === 'light' ? <MoonIcon /> : <SunIcon />}</span>
                  <span>{theme === 'light' ? copy.darkTheme : copy.lightTheme}</span>
                </ActionButton>
              </div>
            </header>
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
          </div>
        ) : !user?.username ? (
          <section className="login-card username-card" aria-labelledby="username-title">
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1 id="username-title">{copy.usernameTitle}</h1>
            <p className="intro">{copy.usernameDescription}</p>
            <form className="username-form" onSubmit={(event) => void saveUsername(event)}>
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
                  onChange={(event) => setUsername(event.currentTarget.value)}
                  placeholder={copy.usernamePlaceholder}
                />
              </div>
              <p className="username-hint">{copy.usernameHint}</p>
              {notice && <p className="notice" role="alert">{notice}</p>}
              <button className="google-login-button username-submit" type="submit" disabled={isSavingUsername}>
                {isSavingUsername ? copy.usernameSaving : copy.usernameContinue}
              </button>
            </form>
          </section>
        ) : (
        <section className="workspace" aria-labelledby="welcome-title">
          <header className="workspace-header">
            <div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h1 id="welcome-title">{copy.headline}</h1>
              <p className="intro">{copy.description}</p>
              {user && <p className="account-label">{copy.account}: {user.email}</p>}
            </div>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              aria-label={copy.uploadFile}
              onChange={(event) => void uploadSelectedFile(event.currentTarget.files?.[0])}
            />
            <button
              className="upload-button"
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <span aria-hidden="true">＋</span>{isUploading ? copy.uploading : copy.uploadFile}
            </button>
          </header>
          <section className="files-panel" aria-labelledby="files-heading">
            <h2 id="files-heading">{copy.filesHeading}</h2>
            {notice && <p className="notice" role="status">{notice}</p>}
            {files.length === 0 ? (
              <p className="empty-files">{copy.emptyFiles}</p>
            ) : (
              <ul className="file-list">
                {files.map((file) => (
                  <li className="file-row" key={file.id}>
                    <div className="file-details">
                      <span className="file-name" title={file.name}>{file.name}</span>
                      <span className="file-meta">
                        {formatFileSize(file.sizeBytes)} · {file.status === 'AVAILABLE' ? copy.fileReady : file.status === 'FAILED' ? copy.fileFailed : copy.fileProcessing}
                      </span>
                    </div>
                    {file.status === 'AVAILABLE' && (
                      <a className="download-link" href={apiUrl(`/api/files/${encodeURIComponent(file.id)}`)}>
                        {copy.download}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
        )}
        <footer className="footer">{copy.footer}</footer>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.23c1.9-1.75 2.99-4.33 2.99-7.37Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.4l-3.23-2.52c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84v-2.6H3.07a10 10 0 0 0 0 9.04l3.34-2.6Z" />
      <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.86-2.86C16.96 2.99 14.7 2 12 2a10 10 0 0 0-8.93 5.48l3.34 2.6C7.2 7.72 9.4 5.96 12 5.96Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M10 17l5-5-5-5m5 5H3m9-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
    </svg>
  );
}
