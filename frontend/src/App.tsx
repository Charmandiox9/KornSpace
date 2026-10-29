import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Sidebar } from './components/Sidebar';
import { FilesPage } from './pages/FilesPage';
import { LoginPage } from './pages/LoginPage';
import { UsernameSetupPage } from './pages/UsernameSetupPage';
import {
  getInitialLanguage,
  getInitialTheme,
  getNextLanguage,
  getNextTheme,
  translations,
  type Language,
  type Theme,
} from './i18n';
import { resolveAppRoute, routePaths } from './routes/routes';
import type { AuthenticatedUser, StoredFile } from './types';

const languageStorageKey = 'kornspace-language';
const themeStorageKey = 'kornspace-theme';
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/u, '');

function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

function apiCredentials(): RequestCredentials {
  return apiBaseUrl ? 'include' : 'same-origin';
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

function setMetaContent(attribute: 'name' | 'property', identifier: string, value: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${identifier}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, identifier);
    document.head.append(element);
  }
  element.setAttribute('content', value);
}

function setCanonicalUrl(href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.append(element);
  }
  element.href = href;
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
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copy = translations[language];
  const route = resolveAppRoute(authStatus, Boolean(user?.username));

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
    function syncPathname() {
      setPathname(window.location.pathname);
    }
    window.addEventListener('popstate', syncPathname);
    return () => window.removeEventListener('popstate', syncPathname);
  }, []);

  useEffect(() => {
    if (!route || pathname === route) return;
    window.history.replaceState({}, '', route);
    setPathname(route);
  }, [pathname, route]);

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
    if (authStatus === 'authenticated' && user?.username) void refreshFiles();
  }, [authStatus, refreshFiles, user?.username]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user?.username || !files.some((file) => file.status === 'PROCESSING')) return undefined;
    const timer = window.setInterval(() => void refreshFiles(), 2500);
    return () => window.clearInterval(timer);
  }, [authStatus, files, refreshFiles, user?.username]);

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
    const isLogin = route === routePaths.login;
    const isOnboarding = route === routePaths.onboarding;
    const title = isLogin
      ? copy.loginMetaTitle
      : isOnboarding
        ? copy.onboardingMetaTitle
        : copy.pageTitle;
    const description = isLogin
      ? copy.loginDescription
      : isOnboarding
        ? copy.usernameDescription
        : copy.description;
    const canonicalUrl = new URL(route ?? pathname, window.location.origin).toString();

    document.documentElement.lang = language;
    document.title = title;
    setMetaContent('name', 'description', description);
    setMetaContent('name', 'application-name', 'KornSpace');
    setMetaContent('name', 'robots', isLogin ? 'index, follow' : 'noindex, nofollow');
    setMetaContent('property', 'og:type', 'website');
    setMetaContent('property', 'og:site_name', 'KornSpace');
    setMetaContent('property', 'og:title', title);
    setMetaContent('property', 'og:description', description);
    setMetaContent('property', 'og:url', canonicalUrl);
    setMetaContent('property', 'og:locale', copy.socialLocale);
    setMetaContent('name', 'twitter:card', 'summary');
    setMetaContent('name', 'twitter:title', title);
    setMetaContent('name', 'twitter:description', description);
    setCanonicalUrl(canonicalUrl);
    savePreference(languageStorageKey, language);
  }, [copy, language, pathname, route]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#111321' : '#f5f6fb');
    savePreference(themeStorageKey, theme);
  }, [theme]);

  const appShellClass = route === routePaths.files ? 'app-shell' : 'app-shell app-shell-public';

  return (
    <div className={appShellClass}>
      {route === routePaths.files && user && (
        <Sidebar
          user={user}
          copy={copy}
          language={language}
          theme={theme}
          onLanguageChange={() => setLanguage(getNextLanguage(language))}
          onThemeChange={() => setTheme(getNextTheme(theme))}
          onLogout={() => void logout()}
        />
      )}
      <main className="page">
        {route === null ? (
          <section className="login-card" aria-live="polite"><p>{copy.loginChecking}</p></section>
        ) : route === routePaths.login ? (
          <LoginPage
            copy={copy}
            language={language}
            theme={theme}
            notice={notice}
            apiUrl={apiUrl}
            onLanguageChange={() => setLanguage(getNextLanguage(language))}
            onThemeChange={() => setTheme(getNextTheme(theme))}
          />
        ) : route === routePaths.onboarding ? (
          <UsernameSetupPage
            copy={copy}
            username={username}
            notice={notice}
            isSaving={isSavingUsername}
            onUsernameChange={setUsername}
            onSubmit={(event) => void saveUsername(event)}
          />
        ) : (
          <FilesPage
            copy={copy}
            files={files}
            notice={notice}
            isUploading={isUploading}
            fileInputRef={fileInputRef}
            apiUrl={apiUrl}
            onUpload={(file) => void uploadSelectedFile(file)}
          />
        )}
        <footer className="footer">{copy.footer}</footer>
      </main>
    </div>
  );
}
