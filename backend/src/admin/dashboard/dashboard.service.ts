import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LOW_STOCK_THRESHOLD } from '../../common/constants';

const PAID_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Aggregated KPIs and charts for the admin dashboard.
 * Aggregation is done in JS over bounded windows — fine for MVP scale.
 */
@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const window30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const window24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const window14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsers30d,
      ordersByStatus,
      revenueAgg,
      todayRevenueAgg,
      lowStockVariants,
      outOfStockVariants,
      inactiveProducts,
      failedPayments24h,
      recentOrders,
      topProducts,
      salesOrders,
      signups,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: window30d } } }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.aggregate({
        where: { status: { in: PAID_STATUSES as any }, createdAt: { gte: window30d } },
        _sum: { finalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: { status: { in: PAID_STATUSES as any }, createdAt: { gte: todayStart } },
        _sum: { finalAmount: true },
      }),
      this.prisma.productVariant.count({
        where: { isActive: true, stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } },
      }),
      this.prisma.productVariant.count({ where: { isActive: true, stock: 0 } }),
      this.prisma.product.count({ where: { isActive: false } }),
      this.prisma.payment.count({
        where: { status: 'FAILED', createdAt: { gte: window24h } },
      }),
      this.prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          finalAmount: true,
          status: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productName'],
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 8,
      }),
      this.prisma.order.findMany({
        where: { status: { in: PAID_STATUSES as any }, createdAt: { gte: window14d } },
        select: { finalAmount: true, createdAt: true },
      }),
      this.prisma.user.findMany({
        where: { deletedAt: null, createdAt: { gte: window14d } },
        select: { createdAt: true },
      }),
    ]);

    // Daily series (last 14 days)
    const salesByDay = new Map<string, { revenue: number; orders: number }>();
    const signupByDay = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const key = dayKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
      salesByDay.set(key, { revenue: 0, orders: 0 });
      signupByDay.set(key, 0);
    }
    for (const order of salesOrders) {
      const entry = salesByDay.get(dayKey(order.createdAt));
      if (entry) {
        entry.revenue += order.finalAmount;
        entry.orders += 1;
      }
    }
    for (const user of signups) {
      const key = dayKey(user.createdAt);
      if (signupByDay.has(key)) signupByDay.set(key, (signupByDay.get(key) || 0) + 1);
    }

    const statusCounts: Record<string, number> = {};
    for (const row of ordersByStatus) {
      statusCounts[row.status] = row._count._all;
    }

    return {
      totals: {
        users: totalUsers,
        newUsers30d,
        orders: statusCounts,
        revenue30d: revenueAgg._sum.finalAmount || 0,
        paidOrders30d: revenueAgg._count,
        revenueToday: todayRevenueAgg._sum.finalAmount || 0,
        pendingPaymentOrders: statusCounts['PENDING_PAYMENT'] || 0,
        lowStockVariants,
        outOfStockVariants,
        inactiveProducts,
        failedPayments24h,
      },
      charts: {
        sales14d: [...salesByDay.entries()].map(([date, v]) => ({ date, ...v })),
        signups14d: [...signupByDay.entries()].map(([date, count]) => ({ date, count })),
      },
      recentOrders,
      topProducts: topProducts.map((row) => ({
        productName: row.productName,
        quantity: row._sum.quantity || 0,
        total: row._sum.total || 0,
      })),
    };
  }
}
