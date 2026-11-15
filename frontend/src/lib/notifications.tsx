import { sileo as toaster } from 'sileo';
import type { SileoOptions, SileoState } from 'sileo';
import type { NotificationOptions } from '@/types';
import { RoosterNotificationIcon } from '@/components/RoosterNotificationIcon';

function branded(options: NotificationOptions, state: SileoState): SileoOptions {
  const { mascot = state === 'error' || state === 'warning', ...toastOptions } = options;
  if (!mascot && options.icon === undefined) return toastOptions;
  return {
    ...toastOptions,
    icon: options.icon !== undefined ? options.icon : <RoosterNotificationIcon state={state} />,
    styles: { ...options.styles, badge: `size-9! rounded-xl! bg-transparent! ${options.styles?.badge ?? ''}` },
  };
}

export const sileo = {
  ...toaster,
  show: (options: NotificationOptions) => toaster.show(branded(options, options.type ?? 'success')),
  success: (options: NotificationOptions) => toaster.success(branded(options, 'success')),
  error: (options: NotificationOptions) => toaster.error(branded(options, 'error')),
  warning: (options: NotificationOptions) => toaster.warning(branded(options, 'warning')),
  info: (options: NotificationOptions) => toaster.info(branded(options, 'info')),
  action: (options: NotificationOptions) => toaster.action(branded(options, 'action')),
};
