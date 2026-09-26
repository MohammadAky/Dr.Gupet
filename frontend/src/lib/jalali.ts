/**
 * Jalali (Shamsi) rendering. The API only returns ISO-8601 UTC strings
 * (README §6.1) — conversion happens here, in one place.
 */

export type JalaliKind = 'date' | 'datetime';

const PERSIAN_LOCALE = 'fa-IR-u-ca-persian';

export function formatJalali(iso: string | number | Date, kind: JalaliKind = 'date'): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(PERSIAN_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(kind === 'datetime' ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

/** "۳ روز پیش" style relative time for lastConfirmedAt etc. */
export function formatRelativeJalali(iso: string | number | Date, now: Date = new Date()): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' });
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, 'month');
  return rtf.format(Math.round(months / 12), 'year');
}

/** Today in ISO (yyyy-mm-dd) — used to forbid future birth dates. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
