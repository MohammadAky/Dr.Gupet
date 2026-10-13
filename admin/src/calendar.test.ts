import { afterEach, expect, it, vi } from 'vitest';
import { addDays, calendarLabel, monthLength, shiftMonth, tehranFields, tehranInstant, todayTehran, toIsoDay, toPersianDay } from './calendar';
afterEach(() => vi.useRealTimers());
it('converts Nowruz, historical birth dates, and current Persian dates without the device timezone', () => {
  expect(toIsoDay({ year: 1405, month: 1, day: 1 })).toBe('2026-03-21');
  expect(toPersianDay('2026-03-21')).toEqual({ year: 1405, month: 1, day: 1 });
  expect(toIsoDay({ year: 1300, month: 1, day: 1 })).toBe('1921-03-21');
  expect(calendarLabel('2026-10-13')).toBe('۲۱ مهر ۱۴۰۵');
});
it('uses the real Persian leap calendar and rejects impossible Esfand dates', () => {
  expect(monthLength(1403, 12)).toBe(30);
  expect(monthLength(1404, 12)).toBe(29);
  expect(toIsoDay({ year: 1403, month: 12, day: 30 })).toBe('2025-03-20');
  expect(() => toIsoDay({ year: 1404, month: 12, day: 30 })).toThrow(RangeError);
  expect(() => toIsoDay({ year: 1405, month: 7, day: 31 })).toThrow(RangeError);
  expect(() => toIsoDay({ year: 1405, month: 13, day: 1 })).toThrow(RangeError);
});
it('crosses Persian year boundaries and clamps an old selected day in shorter months', () => {
  expect(shiftMonth({ year: 1404, month: 12, day: 29 }, 1)).toEqual({ year: 1405, month: 1, day: 29 });
  expect(shiftMonth({ year: 1405, month: 1, day: 31 }, -1)).toEqual({ year: 1404, month: 12, day: 29 });
  expect(addDays('2026-03-20', 1)).toBe('2026-03-21');
});
it('uses Tehran midnight for today, rather than UTC or the visiting device', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T20:29:59Z'));
  expect(todayTehran()).toBe('2026-10-12');
  vi.setSystemTime(new Date('2026-10-12T20:30:00Z'));
  expect(todayTehran()).toBe('2026-10-13');
});
it('resolves current and historical Tehran wall time to the expected ISO instant', () => {
  expect(tehranInstant('2026-10-08', 12, 0)).toBe('2026-10-08T08:30:00.000Z');
  expect(tehranInstant('2020-05-01', 14, 0)).toBe('2020-05-01T09:30:00.000Z');
  expect(tehranFields('2026-10-08T08:30:37.123Z')).toEqual({ date: '2026-10-08', hour: 12, minute: 0 });
  expect(calendarLabel('2026-10-08T08:30:37.123Z', true)).toBe('۱۶ مهر ۱۴۰۵، ۱۲:۰۰');
  expect(() => tehranInstant('2026-10-08', 24, 0)).toThrow(RangeError);
});
