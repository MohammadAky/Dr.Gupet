import { ReportsService } from './reports.service';
import { DashboardService } from '../dashboard/dashboard.service';

/**
 * Issue #8 — dashboard `revenueToday` and report `byDay[today]` must use the
 * same timezone-aware day boundary and agree for the same `tz`.
 *
 * Fixtures (Asia/Tehran = UTC+3:30):
 *   A: 2026-09-30T12:00Z → 15:30 local Sep 30   (Sep-30 bucket)
 *   B: 2026-09-30T21:00Z → 00:30 local Oct  1   (Oct-1 bucket — the split case!)
 *   C: 2026-10-01T10:00Z → 13:30 local Oct  1   (Oct-1 bucket)
 */
const fixtures = [
  { id: 1, status: 'PAID', finalAmount: 1000, createdAt: new Date('2026-09-30T12:00:00Z') },
  { id: 2, status: 'PAID', finalAmount: 2000, createdAt: new Date('2026-09-30T21:00:00Z') },
  { id: 3, status: 'PAID', finalAmount: 4000, createdAt: new Date('2026-10-01T10:00:00Z') },
];

function inRange(d: Date, gte?: Date, lte?: Date) {
  if (gte && d < gte) return false;
  if (lte && d > lte) return false;
  return true;
}

function makePrisma() {
  const filter = (args: any) => {
    const c = args?.where?.createdAt ?? {};
    return fixtures.filter((o) => inRange(o.createdAt, c.gte, c.lte));
  };
  return {
    order: {
      findMany: jest.fn().mockImplementation(async (args: any) => filter(args)),
      groupBy: jest.fn().mockImplementation(async (args: any) => {
        const rows = filter(args);
        const by = new Map<string, number>();
        for (const o of rows) by.set(o.status, (by.get(o.status) ?? 0) + 1);
        return [...by.entries()].map(([status, n]) => ({ status, _count: { _all: n } }));
      }),
      aggregate: jest.fn().mockImplementation(async (args: any) => {
        const rows = filter(args);
        return {
          _sum: { finalAmount: rows.reduce((s, o) => s + o.finalAmount, 0) },
          _count: rows.length,
        };
      }),
    },
    user: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    productVariant: { count: jest.fn().mockResolvedValue(0) },
    product: { count: jest.fn().mockResolvedValue(0) },
    payment: { count: jest.fn().mockResolvedValue(0) },
    orderItem: { groupBy: jest.fn().mockResolvedValue([]) },
  };
}

describe('Dashboard vs report day-boundary consistency (issue #8)', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-01T12:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('one Tehran local day = one bucket (no UTC split)', async () => {
    const service = new ReportsService(makePrisma() as any);
    const result = await service.sales({
      from: '2026-09-29T20:30:00Z',
      to: '2026-10-01T12:00:00Z',
      tz: 'Asia/Tehran',
    });

    const keys = result.byDay.map((d: any) => d.date);
    // fixture B (00:30 local Oct 1) must share the bucket with fixture C
    expect(keys).toEqual(['2026-09-30', '2026-10-01']);
    const oct1 = result.byDay.find((d: any) => d.date === '2026-10-01')!;
    expect(oct1.orders).toBe(2);
    expect(oct1.revenue).toBe(6000);
    const sep30 = result.byDay.find((d: any) => d.date === '2026-09-30')!;
    expect(sep30.orders).toBe(1);
    expect(sep30.revenue).toBe(1000);
  });

  it('dashboard revenueToday equals report byDay[today] for the same tz', async () => {
    const prisma = makePrisma();
    const report = await new ReportsService(prisma as any).sales({
      from: '2026-09-29T20:30:00Z',
      to: '2026-10-01T12:00:00Z',
      tz: 'Asia/Tehran',
    });
    const dashboard = await new DashboardService(prisma as any).getOverview('Asia/Tehran');

    const todayBucket = report.byDay.find((d: any) => d.date === '2026-10-01')!;
    expect(dashboard.totals.revenueToday).toBe(todayBucket.revenue);
    expect(dashboard.tz).toBe('Asia/Tehran');
  });

  it('UTC tz buckets differently (both services agree on UTC too)', async () => {
    const prisma = makePrisma();
    const report = await new ReportsService(prisma as any).sales({
      from: '2026-09-30T00:00:00Z',
      to: '2026-10-01T12:00:00Z',
      tz: 'UTC',
    });
    const dashboard = await new DashboardService(prisma as any).getOverview('UTC');

    // In UTC, fixtures A+B share 2026-09-30 and C is 2026-10-01
    const keys = report.byDay.map((d: any) => d.date);
    expect(keys).toEqual(['2026-09-30', '2026-10-01']);
    const todayBucket = report.byDay.find((d: any) => d.date === '2026-10-01')!;
    expect(dashboard.totals.revenueToday).toBe(todayBucket.revenue);
  });

  it('dashboard 14d chart keys are local calendar days', async () => {
    const dashboard = await new DashboardService(makePrisma() as any).getOverview('Asia/Tehran');
    const keys = dashboard.charts.sales14d.map((d: any) => d.date);
    expect(keys).toHaveLength(14);
    expect(keys[13]).toBe('2026-10-01'); // today (local)
    expect(keys[12]).toBe('2026-09-30');
    // no UTC-split duplicates
    expect(new Set(keys).size).toBe(14);
  });
});
