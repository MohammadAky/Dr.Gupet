import { describe, expect, it } from 'vitest';
import { formatJalali, formatRelativeJalali, todayIso } from './jalali';

describe('formatJalali', () => {
  it('renders the persian calendar year', () => {
    // 2026-03-21 is 1405-01-01 in the Jalali calendar.
    expect(formatJalali('2026-03-21T00:00:00.000Z')).toContain('۱۴۰۵');
  });

  it('returns an empty string for invalid input', () => {
    expect(formatJalali('not-a-date')).toBe('');
  });

  it('supports datetime rendering', () => {
    expect(formatJalali('2026-06-01T10:30:00.000Z', 'datetime')).not.toBe('');
  });
});

describe('formatRelativeJalali', () => {
  it('describes a past date in days', () => {
    const now = new Date('2026-06-10T12:00:00.000Z');
    const value = formatRelativeJalali('2026-06-07T12:00:00.000Z', now);
    expect(value).toContain('روز');
  });
});

describe('todayIso', () => {
  it('uses the ISO yyyy-mm-dd shape', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
