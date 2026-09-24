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
  it('accepts five digits in both digit systems', () => {
    expect(normalizeOtpCode('12345')).toBe('12345');
    expect(normalizeOtpCode('۱۲۳۴۵')).toBe('12345');
  });

  it('rejects anything else', () => {
    expect(normalizeOtpCode('1234')).toBeNull();
    expect(normalizeOtpCode('123456')).toBeNull();
    expect(normalizeOtpCode('abcde')).toBeNull();
  });
});
