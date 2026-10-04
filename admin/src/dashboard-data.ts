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
