import type { UploadItem, UploadToastPresentation, TranslationCatalog } from '../../types';

export function getUploadToastPresentation(item: UploadItem, copy: TranslationCatalog): UploadToastPresentation {
  const titles = {
    queued: copy.uploadWaiting,
    uploading: copy.uploadToastUploading,
    confirming: copy.uploadToastConfirming,
    cancelling: copy.uploadToastCancelling,
    cancelled: copy.uploadToastCancelled,
    cancelFailed: copy.uploadToastUnconfirmed,
    uploaded: copy.uploadToastCompleted,
    processing: copy.uploadToastCompleted,
    invalid: copy.uploadInvalid,
    failed: copy.uploadError,
  };
  const messages = {
    queued: copy.uploadWaiting,
    uploading: copy.uploading,
    confirming: copy.uploadConfirming,
    cancelling: copy.uploadCancelling,
    cancelled: copy.uploadCancelled,
    cancelFailed: copy.uploadCancellationUnconfirmed,
    uploaded: copy.uploadSuccess,
    processing: copy.uploadQueued,
    invalid: copy.uploadInvalid,
    failed: copy.uploadError,
  };
  const success = item.status === 'uploaded' || item.status === 'processing';
  const errorMessage = item.error === 'tooLarge' ? copy.fileLimit
    : item.error === 'empty' ? copy.uploadEmpty
      : item.error === 'invalidName' ? copy.uploadInvalidName : null;
  return {
    title: titles[item.status],
    message: errorMessage ?? (item.completionWon ? copy.uploadCompletionWon : messages[item.status]),
    type: success ? 'success' : ['failed', 'invalid'].includes(item.status) ? 'error'
      : ['cancelled', 'cancelFailed'].includes(item.status) ? 'warning' : 'info',
    duration: success ? 7000 : null,
    action: ['queued', 'uploading', 'confirming'].includes(item.status) ? 'cancel'
      : ['failed', 'cancelled'].includes(item.status) ? 'retry' : item.status === 'cancelFailed' ? 'check' : null,
    showProgress: !['invalid', 'uploaded', 'processing'].includes(item.status),
  };
}
