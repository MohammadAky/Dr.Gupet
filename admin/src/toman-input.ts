const groups = /[,٬،\s\u200e\u200f\u2066-\u2069]/gu;
const digit = /[0-9۰-۹٠-٩]/u;
function ungroup(value: string | number): string {
  return String(value).replace(/[۰-۹]/g, value => String(value.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, value => String(value.charCodeAt(0) - 1632)).replace(groups, '');
}
export function rawTomanInput(value: string | number): string {
  const normalized = String(value).replace(/[۰-۹]/g, value => String(value.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, value => String(value.charCodeAt(0) - 1632)).replace(/[\u200e\u200f\u2066-\u2069]/gu, '').trim();
  if (/[,٬،\s]/u.test(normalized) && !/^\d{1,3}(?:[,٬،\s]\d{3})+$/u.test(normalized)) return normalized;
  return ungroup(normalized);
}
export function formatTomanInput(value: string | number): string {
  const raw = rawTomanInput(value);
  // Invalid signs/decimals remain invalid instead of silently changing the monetary value.
  if (!/^\d*$/u.test(raw)) return String(value);
  if (!raw) return '';
  const chunks = [raw.slice(0, raw.length % 3 || 3)];
  for (let index = chunks[0]!.length; index < raw.length; index += 3) chunks.push(raw.slice(index, index + 3));
  return chunks.join('٬').replace(/\d/g, value => '۰۱۲۳۴۵۶۷۸۹'[Number(value)]!);
}
function caret(display: string, count: number, afterGroup: boolean): number {
  let position = 0;
  let seen = 0;
  while (position < display.length && seen < count) {
    if (digit.test(display[position]!)) seen += 1;
    position += 1;
  }
  if (afterGroup) while (position < display.length && !digit.test(display[position]!)) position += 1;
  return position;
}
export function formatTomanEdit(value: string, start: number, end = start) {
  const raw = ungroup(value);
  const display = /^\d*$/u.test(raw) ? formatTomanInput(raw) : value;
  if (!/^\d*$/u.test(raw)) return { raw, display, start, end };
  const map = (position: number) => caret(display, Array.from(value.slice(0, position)).filter(value => digit.test(value)).length, position > 0 && /[,٬،\s]/u.test(value[position - 1]!));
  return { raw, display, start: map(start), end: map(end) };
}
/** Backspace/Delete beside a grouping separator must delete a digit, not reinsert the comma. */
export function deleteTomanSeparator(value: string, position: number, key: 'Backspace' | 'Delete') {
  let index = key === 'Backspace' ? position - 1 : position;
  if (!/[,٬،]/u.test(value[index] ?? '')) return null;
  index += key === 'Backspace' ? -1 : 1;
  if (!digit.test(value[index] ?? '')) return null;
  const edited = value.slice(0, index) + value.slice(index + 1);
  return formatTomanEdit(edited, key === 'Backspace' ? index : position);
}
