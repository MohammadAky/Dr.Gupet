/** Persian calendar UI with ISO dates kept at the API boundary. No external dependency. */
export const TEHRAN = 'Asia/Tehran';
export const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
export type PersianDay = { year: number; month: number; day: number };
const DAY = 86400000;
const persian = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const tehran = new Intl.DateTimeFormat('en-GB-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: TEHRAN });
export const digits = (value: number) => value.toLocaleString('fa-IR', { useGrouping: false });
export const normalizeCalendarDigits = (value: string) => value.replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632));
const pad = (value: number) => String(value).padStart(2, '0');
const parts = (formatter: Intl.DateTimeFormat, value: Date) => Object.fromEntries(formatter.formatToParts(value).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
export function toPersianDay(iso: string): PersianDay {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid ISO date');
  const value = parts(persian, date);
  return { year: value.year!, month: value.month!, day: value.day! };
}
export function toIsoDay({ year, month, day }: PersianDay): string {
  if (![year, month, day].every(Number.isInteger) || year < 1200 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 31) throw new RangeError('Invalid Persian date');
  const target = year * 10000 + month * 100 + day;
  let low = Math.floor(Date.UTC(year + 621, 0, 1) / DAY);
  let high = Math.floor(Date.UTC(year + 623, 0, 1) / DAY);
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const value = parts(persian, new Date(middle * DAY));
    const key = value.year! * 10000 + value.month! * 100 + value.day!;
    if (key === target) return new Date(middle * DAY).toISOString().slice(0, 10);
    if (key < target) low = middle + 1; else high = middle - 1;
  }
  throw new RangeError('Invalid Persian date');
}
export function monthLength(year: number, month: number): number {
  if (month < 7) return 31;
  if (month < 12) return 30;
  try { toIsoDay({ year, month, day: 30 }); return 30; } catch { return 29; }
}
export function shiftMonth(value: PersianDay, step: number): PersianDay {
  const serial = value.year * 12 + value.month - 1 + step;
  const year = Math.floor(serial / 12);
  const month = serial % 12 + 1;
  return { year, month, day: Math.min(value.day, monthLength(year, month)) };
}
export function addDays(iso: string, step: number): string {
  return new Date(new Date(`${iso}T12:00:00Z`).getTime() + step * DAY).toISOString().slice(0, 10);
}
export function tehranFields(iso: string | Date): { date: string; hour: number; minute: number } {
  const value = parts(tehran, iso instanceof Date ? iso : new Date(iso));
  return { date: `${value.year}-${pad(value.month!)}-${pad(value.day!)}`, hour: value.hour!, minute: value.minute! };
}
export const todayTehran = () => tehranFields(new Date()).date;
/** Resolve Tehran wall time, including historical DST, rather than using the browser timezone. */
export function tehranInstant(date: string, hour: number, minute: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || !Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) throw new RangeError('Invalid time');
  const [year, month, day] = date.split('-').map(Number);
  const wanted = Date.UTC(year!, month! - 1, day!, hour, minute);
  let utc = wanted;
  for (let pass = 0; pass < 4; pass += 1) {
    const seen = tehranFields(new Date(utc));
    const [seenYear, seenMonth, seenDay] = seen.date.split('-').map(Number);
    const difference = wanted - Date.UTC(seenYear!, seenMonth! - 1, seenDay!, seen.hour, seen.minute);
    if (difference === 0) return new Date(utc).toISOString();
    utc += difference;
  }
  throw new RangeError('This local time does not exist');
}
export function calendarLabel(iso: string, withTime = false): string {
  if (!iso) return 'انتخاب تاریخ';
  const time = withTime ? tehranFields(iso) : null;
  const day = toPersianDay(time?.date ?? iso);
  return `${digits(day.day)} ${MONTHS[day.month - 1]} ${digits(day.year)}${time ? `، ${digits(time.hour).padStart(2, '۰')}:${digits(time.minute).padStart(2, '۰')}` : ''}`;
}
