import type { FormEvent, ReactNode } from 'react';
import type { AuthenticatedUser } from './auth';
import type { StoredFile } from './files';
import type { TranslationCatalog } from './i18n';
import type { Language, Theme } from './preferences';

export interface ActionButtonProps {
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  title: string;
}

export interface SidebarProps {
  user: AuthenticatedUser;
  copy: TranslationCatalog;
  language: Language;
  theme: Theme;
  onLanguageChange: () => void;
  onThemeChange: () => void;
  onLogout: () => void;
  pathname: string;
}

export interface PublicLayoutProps {
  children: ReactNode;
  copy: TranslationCatalog;
  language: Language;
  theme: Theme;
  onLanguageChange: () => void;
  onThemeChange: () => void;
}

export interface AccountMenuProps {
  user: AuthenticatedUser;
  copy: TranslationCatalog;
  language: Language;
  theme: Theme;
  onLanguageChange: () => void;
  onThemeChange: () => void;
  onLogout: () => void;
}

export interface AppearanceControlsProps {
  copy: TranslationCatalog;
  language: Language;
  theme: Theme;
  onLanguageChange: () => void;
  onThemeChange: () => void;
}

export interface LoginPageProps {
  copy: TranslationCatalog;
  language: Language;
  theme: Theme;
  notice: string;
  apiUrl: (path: string) => string;
  onLanguageChange: () => void;
  onThemeChange: () => void;
}

export interface UsernameSetupPageProps {
  copy: TranslationCatalog;
  username: string;
  notice: string;
  isSaving: boolean;
  onUsernameChange: (username: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export interface FilesPageProps {
  copy: TranslationCatalog;
  files: StoredFile[];
  trash: StoredFile[];
  initialTrash?: boolean;
  notice: string;
  apiUrl: (path: string) => string;
  onUpload: (files: File[]) => void;
  onMoveToTrash: (file: StoredFile) => void;
  onDeletePermanent: (fileId: string) => void;
  onRestore: (fileId: string) => void;
}

export interface SessionProviderProps {
  children: ReactNode;
}

export interface RootLayoutProps {
  children: ReactNode;
}
