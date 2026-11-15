const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatFileSize(sizeBytes: number, locale = 'es-CL'): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return '—';
  let value = sizeBytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) { value /= 1024; unit += 1; }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat(locale.replace('_', '-'), { maximumFractionDigits: digits }).format(value)} ${UNITS[unit]}`;
}
