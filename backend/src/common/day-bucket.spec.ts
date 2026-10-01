import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_TZ,
  assertValidTz,
  dayKey,
  startOfLocalDay,
  lastNLocalDayStarts,
  previousLocalDayStart,
} from './day-bucket';

/**
 * Issue #8 — timezone-aware daily buckets.
 * Tehran is UTC+3:30 (no DST since 2022): local midnight = 20:30 UTC of the
 * previous day. One local day must map to exactly one bucket.
 */
describe('dayKey — midnight boundaries (issue #8)', () => {
  it('23:59 and 00:00 Asia/Tehran fall on different local days', () => {
    // 2026-09-30 23:59:59 Tehran = 2026-09-30 20:29:59 UTC
    expect(dayKey(new Date('2026-09-30T20:29:59Z'), 'Asia/Tehran')).toBe('2026-09-30');
    // 2026-10-01 00:00:00 Tehran = 2026-09-30 20:30:00 UTC
    expect(dayKey(new Date('2026-09-30T20:30:00Z'), 'Asia/Tehran')).toBe('2026-10-01');
  });

  it('UTC bucketing of the same instants disagrees (the original bug)', () => {
    expect(dayKey(new Date('2026-09-30T20:30:00Z'), 'UTC')).toBe('2026-09-30');
    // ...while Tehran already counts it as Oct 1st
    expect(dayKey(new Date('2026-09-30T20:30:00Z'), 'Asia/Tehran')).toBe('2026-10-01');
  });

  it('ONE local Tehran day never splits into two buckets', () => {
    // Local Oct 1st spans 2026-09-30T20:30Z .. 2026-10-01T20:29Z
    const orders = [
      new Date('2026-09-30T21:00:00Z'), // 00:30 local Oct 1
      new Date('2026-10-01T08:00:00Z'), // 11:30 local Oct 1
      new Date('2026-10-01T20:29:00Z'), // 23:59 local Oct 1
    ];
    const keys = new Set(orders.map((d) => dayKey(d, 'Asia/Tehran')));
    expect([...keys]).toEqual(['2026-10-01']);
  });

  it('UTC mode buckets by UTC calendar day', () => {
    expect(dayKey(new Date('2026-10-01T00:30:00Z'), 'UTC')).toBe('2026-10-01');
    expect(dayKey(new Date('2026-09-30T23:30:00Z'), 'UTC')).toBe('2026-09-30');
    expect(dayKey(new Date('2026-09-30T20:30:00Z'), 'UTC')).toBe('2026-09-30');
  });
});

describe('startOfLocalDay (issue #8)', () => {
  it('Asia/Tehran local midnight is 20:30 UTC of the previous day', () => {
    const start = startOfLocalDay(new Date('2026-10-01T12:00:00Z'), 'Asia/Tehran');
    expect(start.toISOString()).toBe('2026-09-30T20:30:00.000Z');
  });

  it('UTC local midnight is plain UTC midnight', () => {
    const start = startOfLocalDay(new Date('2026-10-01T12:00:00Z'), 'UTC');
    expect(start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('anything inside a local day maps to the same start', () => {
    const a = startOfLocalDay(new Date('2026-09-30T20:30:00Z'), 'Asia/Tehran');
    const b = startOfLocalDay(new Date('2026-10-01T20:29:00Z'), 'Asia/Tehran');
    expect(a.toISOString()).toBe(b.toISOString());
  });
});

describe('7/14/30 selections align to local calendar days (issue #8)', () => {
  it('last N local days are consecutive local calendar days, oldest first', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    const starts = lastNLocalDayStarts(now, 'Asia/Tehran', 7);
    expect(starts).toHaveLength(7);
    expect(starts.map((d) => dayKey(d, 'Asia/Tehran'))).toEqual([
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ]);
    // each is exactly the local midnight instant
    expect(starts[6].toISOString()).toBe('2026-09-30T20:30:00.000Z');
  });

  it('30-day window start is 29 local days before today', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    const today = startOfLocalDay(now, 'Asia/Tehran');
    let start = today;
    for (let i = 1; i < 30; i++) start = previousLocalDayStart(start, 'Asia/Tehran');
    expect(dayKey(start, 'Asia/Tehran')).toBe('2026-09-02');
  });
});

describe('tz validation (issue #8)', () => {
  it('accepts IANA names and defaults to Asia/Tehran', () => {
    expect(assertValidTz('UTC')).toBe('UTC');
    expect(assertValidTz('Asia/Tehran')).toBe('Asia/Tehran');
    expect(assertValidTz(undefined)).toBe(DEFAULT_TZ);
  });

  it('rejects garbage tz with 400', () => {
    expect(() => assertValidTz('Not/AZone')).toThrow(BadRequestException);
    expect(() => assertValidTz('banana')).toThrow(BadRequestException);
  });
});
