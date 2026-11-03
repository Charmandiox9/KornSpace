import type { SileoOptions, SileoState } from 'sileo';
import type { UploadQueue } from './files';
import type { TranslationCatalog } from './i18n';

export interface UploadNotificationsProps {
  queue: UploadQueue;
  copy: TranslationCatalog;
  onCancelUpload: (id: string) => void;
  onRetryUpload: (id: string) => void;
}

export interface UploadToastContentProps extends UploadNotificationsProps {
  uploadId: string;
  toastId: string;
  onDismiss: () => void;
}

export interface UploadToastIconProps {
  state: SileoState;
}

export interface UploadToastPresentation {
  title: string;
  message: string;
  type: SileoState;
  duration: number | null;
  action: 'cancel' | 'retry' | 'check' | null;
  showProgress: boolean;
}

export interface UploadToastOptions extends SileoOptions {
  id: string;
  dismissible: false;
}

