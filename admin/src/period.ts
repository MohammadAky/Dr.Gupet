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

export function periodQuery(period: SalesPeriod, now = new Date()): string {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const days = period === "today" ? 1 : Number.parseInt(period, 10);
  from.setDate(from.getDate() - days + 1);
  const query = new URLSearchParams({
    from: from.toISOString(),
    to: now.toISOString(),
  });
  return `/admin/reports/sales?${query.toString()}`;
}

export function sampleSalesReport(period: SalesPeriod, now = new Date()): SalesReport {
  const days = period === "today" ? 1 : Number.parseInt(period, 10);
  const byDay = Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days + index + 1);
    const orders = 5 + ((index * 7 + 3) % 14);
    return {
      date: date.toISOString().slice(0, 10),
      orders,
      revenue: orders * (480_000 + ((index * 3) % 5) * 65_000),
    };
  });
  return {
    totals: {
      orders: byDay.reduce((sum, day) => sum + day.orders, 0),
      paidOrders: byDay.reduce((sum, day) => sum + Math.max(0, day.orders - 2), 0),
      revenue: byDay.reduce((sum, day) => sum + day.revenue, 0),
    },
    byDay,
  };
}
