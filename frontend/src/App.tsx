import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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

interface StoredFile {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  status: 'PROCESSING' | 'AVAILABLE' | 'FAILED';
  checksum: string | null;
  createdAt: string;
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
  const [notice, setNotice] = useState('');
  const [isUploading, setIsUploading] = useState(false);
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
      const response = await fetch('/api/files');
      if (!response.ok) throw new Error(copy.loadError);
      const payload: unknown = await response.json();
      if (!Array.isArray(payload) || !payload.every(isStoredFile)) throw new Error(copy.loadError);
      setFiles(payload);
    } catch {
      setNotice(copy.loadError);
    }
  }, [copy.loadError]);

  useEffect(() => {
    void refreshFiles();
  }, [refreshFiles]);

  useEffect(() => {
    if (!files.some((file) => file.status === 'PROCESSING')) return undefined;
    const timer = window.setInterval(() => void refreshFiles(), 2500);
    return () => window.clearInterval(timer);
  }, [files, refreshFiles]);

  async function uploadSelectedFile(file: File | undefined): Promise<void> {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setNotice(copy.fileLimit);
      return;
    }
    setIsUploading(true);
    setNotice(copy.uploading);
    try {
      const response = await fetch(`/api/files?name=${encodeURIComponent(file.name)}`, {
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
    <div className="app-shell">
      <aside className="sidebar" aria-label={copy.appearanceControls}>
        <a className="brand" href="/" aria-label="KornSpace">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span className="brand-name">KornSpace</span>
        </a>

        <section className="sidebar-actions" aria-label={copy.appearanceControls}>
          <p className="sidebar-section-label">{copy.appearanceControls}</p>
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
        </section>
        <div className="sidebar-spacer" />
        <p className="sidebar-caption">KornSpace</p>
      </aside>

      <main className="page">
        <section className="workspace" aria-labelledby="welcome-title">
          <header className="workspace-header">
            <div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h1 id="welcome-title">{copy.headline}</h1>
              <p className="intro">{copy.description}</p>
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
                      <a className="download-link" href={`/api/files/${encodeURIComponent(file.id)}`}>
                        {copy.download}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
        <footer className="footer">{copy.footer}</footer>
      </main>
    </div>
  );
}
