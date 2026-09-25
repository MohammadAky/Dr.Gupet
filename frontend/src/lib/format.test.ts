import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatToman,
  formatWeight,
  groupDigits,
  toEnDigits,
  toFaDigits,
} from './format';

describe('digit helpers', () => {
  it('maps latin digits to persian', () => {
    expect(toFaDigits('123')).toBe('۱۲۳');
  });

  it('maps persian and arabic digits back to latin', () => {
    expect(toEnDigits('۱۲۳')).toBe('123');
    expect(toEnDigits('٤٥٦')).toBe('456');
  });
});

describe('money formatting', () => {
  it('groups thousands', () => {
    expect(groupDigits(1250000)).toBe('1,250,000');
  });

  it('renders toman with persian digits', () => {
    expect(formatToman(1250000)).toBe('۱٬۲۵۰٬۰۰۰ تومان');
  });

  it('renders amounts without the unit', () => {
    expect(formatAmount(50_000)).toBe('۵۰٬۰۰۰');
  });

  it('never produces decimals', () => {
    expect(groupDigits(999.9)).toBe('999');
  });
});

describe('weight formatting', () => {
  it('converts whole kilograms', () => {
    expect(formatWeight(2000)).toBe('۲ کیلوگرم');
  });

  it('keeps grams otherwise', () => {
    expect(formatWeight(500)).toBe('۵۰۰ گرم');
  });
});
