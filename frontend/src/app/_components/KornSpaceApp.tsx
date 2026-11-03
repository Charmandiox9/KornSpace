'use client';

import type { FileStatusEvent, StoredFile } from '@/types';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { LoginPage } from '@/features/auth/LoginPage';
import { isAuthenticatedUser } from '@/features/auth/is-authenticated-user';
import { useSession } from '@/features/auth/SessionProvider';
import { UsernameSetupPage } from '@/features/auth/UsernameSetupPage';
import { FilesPage } from '@/features/files/FilesPage';
import { UploadNotifications } from '@/features/files/UploadNotifications';
import { isStoredFile } from '@/features/files/is-stored-file';
import { authenticatedFetch, apiUrl } from '@/lib/api-client';
import { translations } from '@/i18n';
import { usePreferences } from '@/hooks/use-preferences';
import { useUploadQueue } from '@/hooks/use-upload-queue';
import { getSessionDestination } from '@/features/auth/session-destination';
import { sileo } from 'sileo';

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

export default function KornSpaceApp() {
  const { language, theme, toggleLanguage, toggleTheme } = usePreferences();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [trash, setTrash] = useState<StoredFile[]>([]);
  const { status: authStatus, user, updateUser, logout: endSession } = useSession();
  const [notice, setNotice] = useState('');
  const [username, setUsername] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const pathname = usePathname() ?? '/login';
  const router = useRouter();
  const refreshVersion = useRef(0);
  const copy = translations[language];
  const route = getSessionDestination(authStatus, Boolean(user?.username));

  const refreshFiles = useCallback(async (includeTrash = true): Promise<void> => {
    if (!user?.id) return;
    const version = ++refreshVersion.current;
    try {
      const filesResponse = await authenticatedFetch('/api/files');
      if (!filesResponse.ok) throw new Error(copy.loadError);
      const filesPayload: unknown = await filesResponse.json();
      if (!Array.isArray(filesPayload) || !filesPayload.every(isStoredFile)) throw new Error(copy.loadError);
      let trashPayload: unknown;
      if (includeTrash) {
        const trashResponse = await authenticatedFetch('/api/files/trash');
        if (!trashResponse.ok) throw new Error(copy.loadError);
        trashPayload = await trashResponse.json();
        if (!Array.isArray(trashPayload) || !trashPayload.every(isStoredFile)) throw new Error(copy.loadError);
      }
      if (version === refreshVersion.current) {
        setFiles(filesPayload);
        if (includeTrash && Array.isArray(trashPayload)) setTrash(trashPayload);
      }
    } catch {
      if (version === refreshVersion.current) setNotice(copy.loadError);
    }
  }, [copy.loadError, user?.id]);
  const { queue, enqueue, cancelItem, retryItem } = useUploadQueue(() => refreshFiles(false), user?.id);
  async function mutateFile(path: string, method: 'POST' | 'DELETE'): Promise<void> {
    try {
      const response = await authenticatedFetch(path, { method });
      if (!response.ok) throw new Error(copy.loadError);
      setNotice('');
      const title = path.endsWith('/trash') ? copy.fileMovedToTrash
        : path.endsWith('/restore') ? copy.fileRestored : copy.filePermanentlyDeleted;
      sileo.success({ title, duration: 4000 });
      await refreshFiles();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : copy.fileActionFailed;
      setNotice(message);
      sileo.error({ title: copy.fileActionFailed, description: message, duration: 5000 });
    }
  }

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      refreshVersion.current += 1;
      setFiles([]);
      setTrash([]);
    }
    return () => { refreshVersion.current += 1; };
  }, [authStatus, user?.id]);

  useEffect(() => {
    if (!route || pathname === route || (route === '/files' && pathname === '/trash')) return;
    router.replace(route);
  }, [pathname, route, router]);

  useEffect(() => {
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
      router.replace(pathname, { scroll: false });
    }
  }, [
    copy.loginErrorGoogle,
    copy.loginErrorConfiguration,
    copy.loginErrorValidation,
    copy.loginErrorProvider,
    copy.loginErrorDatabase,
    copy.loginErrorServer,
    pathname,
    router,
  ]);

  async function logout(): Promise<void> {
    try {
      await endSession();
      setFiles([]);
    } catch {
      setNotice(copy.logoutFailure);
    }
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
      updateUser(payload);
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
    if (authStatus !== 'authenticated' || !user?.username || !['/files', '/trash'].includes(pathname)) return undefined;
    let disposed = false;
    let socket: WebSocket | undefined;
    let retryTimer: number | undefined;
    let eventRefreshTimer: number | undefined;
    let retryDelay = 500;
    let hasConnected = false;
    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const backend = process.env.NEXT_PUBLIC_API_WS_URL
        ? process.env.NEXT_PUBLIC_API_WS_URL.replace(/^http/u, 'ws')
        : `${protocol}//${window.location.hostname}${window.location.port === '3001' ? ':3000' : window.location.port ? `:${window.location.port}` : ''}`;
      socket = new WebSocket(`${backend}/api/files/events`);
      socket.addEventListener('open', () => {
        retryDelay = 500;
        if (hasConnected) void refreshFiles(false);
        hasConnected = true;
      });
      socket.addEventListener('message', (event) => {
        let payload: unknown;
        try { payload = JSON.parse(String(event.data)); } catch { return; }
        if (typeof payload !== 'object' || payload === null) return;
        const message = payload as Partial<FileStatusEvent>;
        if (message.type === 'file.status' && typeof message.fileId === 'string'
          && (message.status === 'AVAILABLE' || message.status === 'FAILED')) {
          if (eventRefreshTimer !== undefined) window.clearTimeout(eventRefreshTimer);
          eventRefreshTimer = window.setTimeout(() => void refreshFiles(false), 100);
        }
      });
      socket.addEventListener('close', () => {
        if (disposed) return;
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 10000);
      });
      socket.addEventListener('error', () => socket?.close());
    };
    connect();
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (eventRefreshTimer !== undefined) window.clearTimeout(eventRefreshTimer);
      socket?.close();
    };
  }, [authStatus, pathname, refreshFiles, user?.username]);

  useLayoutEffect(() => {
    const isLogin = route === '/login';
    const isOnboarding = route === '/onboarding';
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
  }, [copy, language, pathname, route]);

  const appShellClass = route === '/files'
    ? 'grid min-h-svh grid-cols-[256px_minmax(0,1fr)] bg-linear-to-br from-page to-raised max-[760px]:grid-cols-[78px_minmax(0,1fr)] max-[420px]:grid-cols-[62px_minmax(0,1fr)]'
    : 'flex min-h-svh flex-col bg-linear-to-br from-page to-raised [&>main]:min-h-screen [&>main]:w-full [&>main]:flex-1';

  return (
    <div className={appShellClass}>
      <UploadNotifications queue={queue} copy={copy} onCancelUpload={cancelItem} onRetryUpload={retryItem} />
      {route === '/files' && user && (
        <Sidebar
          user={user}
          copy={copy}
          language={language}
          theme={theme}
          onLanguageChange={toggleLanguage}
          onThemeChange={toggleTheme}
          onLogout={() => void logout()}
          pathname={pathname}
        />
      )}
      <main className="grid min-h-0 grid-rows-[1fr_auto] justify-items-center px-[clamp(20px,4vw,56px)] pt-8 pb-[22px] max-[760px]:px-4 max-[760px]:pt-6 max-[760px]:pb-[18px] max-[420px]:px-2.5">
        {route === null ? (
          <section className="relative flex w-full max-w-[620px] self-center flex-col items-center overflow-hidden rounded-[20px] border border-line bg-surface px-[clamp(22px,7vw,64px)] py-[clamp(34px,7vw,68px)] text-center shadow-panel justify-self-center before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-linear-to-r before:from-accent before:to-secondary" aria-live="polite"><p>{copy.loginChecking}</p></section>
        ) : route === '/login' ? (
          <LoginPage
            copy={copy}
            language={language}
            theme={theme}
            notice={notice}
            apiUrl={apiUrl}
            onLanguageChange={toggleLanguage}
            onThemeChange={toggleTheme}
          />
        ) : route === '/onboarding' ? (
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
            trash={trash}
            initialTrash={pathname === '/trash'}
            notice={notice}
            apiUrl={apiUrl}
            onUpload={enqueue}
            onMoveToTrash={(file) => void mutateFile(`/api/files/${encodeURIComponent(file.id)}/trash`, 'POST')}
            onDeletePermanent={(id) => void mutateFile(`/api/files/${encodeURIComponent(id)}/permanent`, 'DELETE')}
            onRestore={(id) => void mutateFile(`/api/files/${encodeURIComponent(id)}/restore`, 'POST')}
          />
        )}
        <footer className="text-center text-[11px] text-muted">{copy.footer}</footer>
      </main>
    </div>
  );
}
