import type { FormEvent, ReactNode } from 'react';
import type { AuthenticatedUser } from './auth';
import type { StoredFile, StoredFolder, ItemPreference, ItemOrganizationPatch } from './files';
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
  onDriveRoot?: () => void;
  user: AuthenticatedUser;
  copy: TranslationCatalog;
  language: Language;
  theme: Theme;
  onLanguageChange: () => void;
  onThemeChange: () => void;
  onLogout: () => void;
}

export interface LocationItem {
  /** `null` representa la raíz. */
  id: string | null;
  name: string;
}

export interface WorkspaceHeaderProps {
  copy: TranslationCatalog;
  /** De la raíz a la carpeta actual; el último elemento es la ubicación actual. */
  location: LocationItem[];
  onNavigate?: (folderId: string | null) => void;
  /** Si no se pasa, el botón de subir no se muestra. */
  onUploadClick?: () => void;
  onUploadFolderClick?: () => void;
  /** Si no se pasa, el botón de crear carpeta no se muestra. */
  onCreateFolder?: () => void;
}

export interface CreateFolderDialogProps {
  copy: TranslationCatalog;
  onClose: () => void;
  /** Debe lanzar un `Error` con un mensaje ya traducido si falla; el diálogo lo muestra. */
  onSubmit: (name: string) => Promise<void>;
}

export interface SharedPageProps {
  copy: TranslationCatalog;
  files: StoredFile[];
  notice: string;
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

export interface FolderActionSelection {
  folder: StoredFolder;
  action: 'rename' | 'delete' | 'share';
}

export interface FolderActionDialogProps {
  folder: StoredFolder;
  action: 'rename' | 'delete' | 'share';
  copy: TranslationCatalog;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export interface FilesPageProps {
  itemPreferences?: ItemPreference[];
  showQuickAccess?: boolean;
  onOrganize?: (kind: 'files' | 'folders', id: string, patch: ItemOrganizationPatch) => Promise<void>;
  userId?: string;
  title?: string;
  toolbar?: ReactNode;
  onChanged?: () => Promise<void>;
  isLoading?: boolean;
  copy: TranslationCatalog;
  files: StoredFile[];
  folders: StoredFolder[];
  currentFolder: StoredFolder | null;
  breadcrumbs: StoredFolder[];
  currentFolderId: string | null;
  trash: StoredFile[];
  initialTrash?: boolean;
  notice: string;
  apiUrl: (path: string) => string;
  onUpload: (files: File[], folderId: string | null) => void;
  onUploadDirectory: (files: File[]) => void;
  onNavigate: (folderId: string | null) => void;
  onMoveToTrash: (file: StoredFile) => void;
  onDeletePermanent: (fileId: string) => void;
  onRestore: (fileId: string) => void;
  /** Si no se pasa, la acción «Nueva carpeta» no se muestra. */
  onCreateFolder?: (name: string, parentId: string | null) => Promise<void>;
}

export interface FileEditDialogProps {
  file: StoredFile;
  mode: 'rename' | 'share';
  copy: TranslationCatalog;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export interface FileConflictDialogProps {
  name: string;
  copy: TranslationCatalog;
  onResolve: (replace: boolean) => void;
}

export interface LibraryPageProps extends Omit<FilesPageProps, 'files'> {
  sharedOnly?: boolean;
  refreshKey?: number;
}

export interface FileViewerProps {
  file: StoredFile;
  copy: TranslationCatalog;
  apiUrl: (path: string) => string;
  onClose: () => void;
  onDelete: () => void;
}

export interface SessionProviderProps {
  children: ReactNode;
}

export interface RootLayoutProps {
  children: ReactNode;
}

export interface ShareAccessListProps {
  resourceId: string;
  kind: 'files' | 'folders';
  copy: TranslationCatalog;
  refreshKey?: number;
  onChanged: () => Promise<void>;
}

export interface ItemOrganizeMenuProps {
  preference?: ItemPreference;
  copy: TranslationCatalog;
  onUpdate: (patch: ItemOrganizationPatch) => Promise<void>;
}
export interface ActionIconProps { name: 'open' | 'rename' | 'share' | 'organize' | 'info' | 'delete' | 'download' | 'star' | 'shortcut'; }

export interface MotionControlProps { copy: TranslationCatalog; }
export interface MascotSceneProps { copy: TranslationCatalog; theme: Theme; }
export interface MascotSceneHandle { setMotion: (enabled: boolean) => void; setTheme: (dark: boolean) => void; dispose: () => void; }
export interface MascotSceneOptions { dark: boolean; motion: boolean; onUnavailable?: () => void; }
