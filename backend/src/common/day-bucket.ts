import { BadRequestException } from '@nestjs/common';

/**
 * Timezone-aware daily bucketing (issue #8).
 *
 * Contract: report/dashboard endpoints accept `tz` (IANA name, e.g.
 * 'Asia/Tehran' or 'UTC'). Day buckets (`YYYY-MM-DD`) are **calendar days in
 * that timezone**, not UTC days — so one local day never splits into two
 * buckets. Default timezone is `DEFAULT_TZ`.
 */
export const DEFAULT_TZ = 'Asia/Tehran';

export function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function assertValidTz(tz: string | undefined): string {
  const value = tz ?? DEFAULT_TZ;
  if (!isValidTz(value)) {
    throw new BadRequestException('منطقه زمانی (tz) نامعتبر است');
  }
  return value;
}

function tzOffsetMs(date: Date, tz: string): number {
  // Wall-clock time in `tz` expressed as if it were UTC, minus the real UTC
  // instant = the offset of the zone at that moment (DST-aware).
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/** Calendar date `YYYY-MM-DD` of `date` as seen in `tz`. */
export function dayKey(date: Date, tz: string = DEFAULT_TZ): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** UTC instant of local midnight (00:00) of `date`'s local day in `tz`. */
export function startOfLocalDay(date: Date, tz: string = DEFAULT_TZ): Date {
  const key = dayKey(date, tz); // YYYY-MM-DD
  const utcMidnight = new Date(`${key}T00:00:00Z`).getTime();
  // First guess with the offset at UTC midnight, then refine once (handles
  // normal DST/offset changes; zones without midnight-adjacent transitions
  // converge exactly).
  let guess = utcMidnight - tzOffsetMs(new Date(utcMidnight), tz);
  guess = utcMidnight - tzOffsetMs(new Date(guess), tz);
  return new Date(guess);
}

/** Start of the previous local day (DST-safe: 12h back always lands in it). */
export function previousLocalDayStart(dayStart: Date, tz: string = DEFAULT_TZ): Date {
  return startOfLocalDay(new Date(dayStart.getTime() - 12 * 3600 * 1000), tz);
}

/** The last `n` local-day starts, oldest first, ending with today in `tz`. */
export function lastNLocalDayStarts(now: Date, tz: string = DEFAULT_TZ, n = 14): Date[] {
  let cursor = startOfLocalDay(now, tz);
  const starts: Date[] = [cursor];
  for (let i = 1; i < n; i++) {
    cursor = previousLocalDayStart(cursor, tz);
    starts.push(cursor);
  }
  return starts.reverse();
}
