import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LOW_STOCK_THRESHOLD } from '../../common/constants';

const PAID_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

export interface ReportRange {
  from?: string;
  to?: string;
}

function rangeDates(range: ReportRange): { start: Date; end: Date } {
  const end = range.to ? new Date(range.to) : new Date();
  const start = range.from
    ? new Date(range.from)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start, end };
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /** Sales report: daily revenue/orders plus totals and status breakdown. */
  async sales(range: ReportRange) {
    const { start, end } = rangeDates(range);

    const [orders, byStatus] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { finalAmount: true, status: true, createdAt: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: start, lte: end } },
        _count: { _all: true },
      }),
    ]);

    const byDay = new Map<string, { orders: number; revenue: number }>();
    let revenue = 0;
    let paidOrders = 0;
    for (const order of orders) {
      const key = dayKey(order.createdAt);
      const entry = byDay.get(key) || { orders: 0, revenue: 0 };
      entry.orders += 1;
      if ((PAID_STATUSES as readonly string[]).includes(order.status)) {
        entry.revenue += order.finalAmount;
        revenue += order.finalAmount;
        paidOrders += 1;
      }
      byDay.set(key, entry);
    }

    return {
      from: start,
      to: end,
      totals: { orders: orders.length, paidOrders, revenue },
      byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
      byDay: [...byDay.entries()]
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async topProducts(range: ReportRange, limit = 20) {
    const { start, end } = rangeDates(range);
    const rows = await this.prisma.orderItem.groupBy({
      by: ['productName'],
      where: { order: { createdAt: { gte: start, lte: end } } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });
    return {
      from: start,
      to: end,
      data: rows.map((row) => ({
        productName: row.productName,
        quantity: row._sum.quantity || 0,
        total: row._sum.total || 0,
      })),
    };
  }

  async lowStock(threshold?: number) {
    const limitValue = threshold ?? LOW_STOCK_THRESHOLD;
    const variants = await this.prisma.productVariant.findMany({
      where: { isActive: true, stock: { lte: limitValue } },
      select: {
        id: true,
        sku: true,
        weightGram: true,
        stock: true,
        price: true,
        product: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: [{ stock: 'asc' }, { product: { name: 'asc' } }],
    });
    return { threshold: limitValue, data: variants };
  }

  async userGrowth(range: ReportRange) {
    const { start, end } = rangeDates(range);
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, createdAt: { gte: start, lte: end } },
      select: { createdAt: true, role: true },
    });

    const byDay = new Map<string, number>();
    let admins = 0;
    for (const user of users) {
      const key = dayKey(user.createdAt);
      byDay.set(key, (byDay.get(key) || 0) + 1);
      if (user.role === 'ADMIN') admins += 1;
    }

    return {
      from: start,
      to: end,
      totals: { users: users.length, admins, customers: users.length - admins },
      byDay: [...byDay.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async couponPerformance() {
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { redemptions: true } },
      },
    });

    const amounts = await this.prisma.couponRedemption.groupBy({
      by: ['couponId'],
      _sum: { amount: true },
    });
    const amountByCoupon = new Map(amounts.map((row) => [row.couponId, row._sum.amount || 0]));

    return {
      data: coupons.map((coupon) => ({
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        isActive: coupon.isActive,
        redemptions: coupon._count.redemptions,
        totalDiscount: amountByCoupon.get(coupon.id) || 0,
      })),
    };
  }

  // ---- CSV builders ----

  async buildSalesCsv(range: ReportRange): Promise<string> {
    const report = await this.sales(range);
    return toCsv(
      ['date', 'orders', 'revenue'],
      report.byDay.map((row) => [row.date, row.orders, row.revenue]),
    );
  }

  async buildTopProductsCsv(range: ReportRange, limit = 20): Promise<string> {
    const report = await this.topProducts(range, limit);
    return toCsv(
      ['productName', 'quantity', 'total'],
      report.data.map((row) => [row.productName, row.quantity, row.total]),
    );
  }

  async buildUserGrowthCsv(range: ReportRange): Promise<string> {
    const report = await this.userGrowth(range);
    return toCsv(
      ['date', 'signups'],
      report.byDay.map((row) => [row.date, row.count]),
    );
  }

  async buildCouponsCsv(): Promise<string> {
    const report = await this.couponPerformance();
    return toCsv(
      ['code', 'type', 'value', 'isActive', 'redemptions', 'totalDiscount'],
      report.data.map((row) => [
        row.code,
        row.type,
        row.value,
        row.isActive ? 'true' : 'false',
        row.redemptions,
        row.totalDiscount,
      ]),
    );
  }
}
