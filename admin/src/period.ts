export type SalesPeriod = "today" | "7d" | "14d" | "30d";

export interface SalesReport {
  totals: { orders: number; paidOrders: number; revenue: number };
  byDay: Array<{ date: string; orders: number; revenue: number }>;
}

export const periodLabels: Record<SalesPeriod, string> = {
  today: "امروز",
  "7d": "۷ روز اخیر",
  "14d": "۱۴ روز اخیر",
  "30d": "۳۰ روز اخیر",
};

export const REPORT_TIME_ZONE = "Asia/Tehran";
const tehranParts = new Intl.DateTimeFormat("en-US", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hourCycle: "h23",
});

function parts(date: Date) {
  const values = Object.fromEntries(
    tehranParts.formatToParts(date).filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const get = (key: string): number => {
    const value = values[key];
    if (!Number.isInteger(value)) throw new Error("زمان گزارش معتبر نیست.");
    return value!;
  };
  return {
    year: get("year"), month: get("month"), day: get("day"),
    hour: get("hour"), minute: get("minute"), second: get("second"),
  };
}

function tehranMidnight(now: Date, days: number): Date {
  const current = parts(now);
  const wanted = Date.UTC(current.year, current.month - 1, current.day - days + 1);
  let utc = wanted;
  // Convert a wall-clock midnight in the IANA zone to an instant. Iterating
  // accounts for zone-offset rules without hard-coding Iran's current offset.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const seen = parts(new Date(utc));
    const seenWall = Date.UTC(seen.year, seen.month - 1, seen.day,
      seen.hour, seen.minute, seen.second);
    utc += wanted - seenWall;
  }
  return new Date(utc);
}

export function tehranDayKey(date: Date): string {
  const value = parts(date);
  return [value.year, value.month, value.day].map((part, index) =>
    String(part).padStart(index === 0 ? 4 : 2, "0")).join("-");
}

export function periodQuery(period: SalesPeriod, now = new Date()): string {
  const days = period === "today" ? 1 : Number.parseInt(period, 10);
  const from = tehranMidnight(now, days);
  const query = new URLSearchParams({
    from: from.toISOString(),
    to: now.toISOString(),
    tz: REPORT_TIME_ZONE,
  });
  return `/admin/reports/sales?${query.toString()}`;
}
