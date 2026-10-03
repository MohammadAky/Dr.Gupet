import { describe, expect, it } from 'vitest';
import { normalizeOtpCode, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('keeps a valid latin phone', () => {
    expect(normalizePhone('09123456789')).toBe('09123456789');
  });

  it('converts persian digits', () => {
    expect(normalizePhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
  });

  it('converts arabic digits', () => {
    expect(normalizePhone('٠٩١٢٣٤٥٦٧٨٩')).toBe('09123456789');
  });

  it('accepts +98 and 0098 prefixes', () => {
    expect(normalizePhone('+989123456789')).toBe('09123456789');
    expect(normalizePhone('00989123456789')).toBe('09123456789');
  });

  it('strips spaces and dashes', () => {
    expect(normalizePhone('0912 345-6789')).toBe('09123456789');
  });

  it('rejects short or invalid numbers', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('08123456789')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});

describe('normalizeOtpCode', () => {
  it('accepts five or six digits in Latin, Persian, and Arabic digit systems', () => {
    expect(normalizeOtpCode('12345')).toBe('12345');
    expect(normalizeOtpCode('۱۲۳۴۵')).toBe('12345');
    expect(normalizeOtpCode('123456')).toBe('123456');
    expect(normalizeOtpCode('۱۲۳۴۵۶')).toBe('123456');
    expect(normalizeOtpCode('١٢٣٤٥٦')).toBe('123456');
  });

  it('rejects too-short, too-long, and nonnumeric codes', () => {
    expect(normalizeOtpCode('1234')).toBeNull();
    expect(normalizeOtpCode('1234567')).toBeNull();
    expect(normalizeOtpCode('12a345')).toBeNull();
    expect(normalizeOtpCode('abcde')).toBeNull();
  });
});
