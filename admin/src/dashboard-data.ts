export interface DashboardData {
  totals: {
    users: number;
    newUsers30d: number;
    orders: Record<string, number>;
    revenue30d: number;
    paidOrders30d: number;
    revenueToday: number;
    pendingPaymentOrders: number;
    lowStockVariants: number;
    outOfStockVariants: number;
    inactiveProducts: number;
    failedPayments24h: number;
  };
  charts: {
    sales14d: Array<{ date: string; revenue: number; orders: number }>;
    signups14d: Array<{ date: string; count: number }>;
  };
  recentOrders: Array<{
    id: number;
    orderNumber: string;
    finalAmount: number;
    status: string;
    createdAt: string;
    user: { firstName: string | null; lastName: string | null; phone: string };
  }>;
  topProducts: Array<{ productName: string; quantity: number; total: number }>;
}

export const sampleDashboard: DashboardData | null = import.meta.env.DEV
  ? {
      totals: {
        users: 1284,
        newUsers30d: 87,
        orders: {
          PENDING_PAYMENT: 12,
          PAID: 28,
          PROCESSING: 13,
          SHIPPED: 11,
          DELIVERED: 142,
        },
        revenue30d: 184_250_000,
        paidOrders30d: 194,
        revenueToday: 6_450_000,
        pendingPaymentOrders: 12,
        lowStockVariants: 8,
        outOfStockVariants: 3,
        inactiveProducts: 5,
        failedPayments24h: 2,
      },
      charts: {
        sales14d: [18, 32, 24, 47, 36, 55, 43, 62, 51, 71, 58, 69, 84, 73].map(
          (n, i) => ({
            date: new Date(Date.UTC(2026, 8, 17 + i))
              .toISOString()
              .slice(0, 10),
            revenue: n * 100_000,
            orders: Math.round(n / 5),
          }),
        ),
        signups14d: [],
      },
      recentOrders: [
        {
          id: 1,
          orderNumber: "DG-2026-1048",
          finalAmount: 1_780_000,
          status: "PROCESSING",
          createdAt: "2026-09-30T09:20:00.000Z",
          user: { firstName: "نگار", lastName: "محمدی", phone: "۰۹۱۲•••۴۲۱۵" },
        },
        {
          id: 2,
          orderNumber: "DG-2026-1047",
          finalAmount: 2_450_000,
          status: "SHIPPED",
          createdAt: "2026-09-30T08:15:00.000Z",
          user: { firstName: "علی", lastName: "رضایی", phone: "۰۹۱۹•••۳۶۷۲" },
        },
        {
          id: 3,
          orderNumber: "DG-2026-1046",
          finalAmount: 890_000,
          status: "PENDING_PAYMENT",
          createdAt: "2026-09-29T15:45:00.000Z",
          user: { firstName: "سارا", lastName: "احمدی", phone: "۰۹۳۵•••۸۱۰۹" },
        },
      ],
      topProducts: [
        { productName: "غذای خشک سگ بالغ", quantity: 42, total: 37_800_000 },
        { productName: "غذای خشک گربه عقیم", quantity: 36, total: 32_400_000 },
        { productName: "غذای خشک توله‌سگ", quantity: 25, total: 20_500_000 },
      ],
    }
  : null;
