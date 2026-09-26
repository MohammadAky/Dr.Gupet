import { toEnDigits } from './format';

/**
 * Mirrors backend/src/common/utils/phone.util.ts:
 * accepts Persian/Arabic digits, +98 / 0098 / 98 prefixes, spaces and dashes,
 * and normalizes to 09XXXXXXXXX. Returns null when the input cannot be normalized.
 */
export function normalizePhone(input: string): string | null {
  let value = toEnDigits(input ?? '').trim();
  value = value.replace(/[\s\-().]/g, '');

  if (value.startsWith('+98')) value = `0${value.slice(3)}`;
  else if (value.startsWith('0098')) value = `0${value.slice(4)}`;
  else if (value.startsWith('98') && value.length === 12) value = `0${value.slice(2)}`;
  else if (value.startsWith('9') && value.length === 10) value = `0${value}`;

  return /^09\d{9}$/.test(value) ? value : null;
}

/** 5-digit OTP code, Persian digits allowed. */
export function normalizeOtpCode(input: string): string | null {
  const value = toEnDigits(input ?? '').replace(/\D/g, '');
  return /^\d{5}$/.test(value) ? value : null;
}
