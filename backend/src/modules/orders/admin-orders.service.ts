import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStockService } from './order-stock.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { normalizeFa } from '../../common/utils/normalize-fa.util';

/** Allowed admin transitions: from -> to[] */
const TRANSITIONS: Record<string, string[]> = {
  PAID: ['PROCESSING'],
  PROCESSING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
};

const ADMIN_ORDER_INCLUDE = {
  items: {
    select: {
      id: true,
      productName: true,
      weightGram: true,
      unitPrice: true,
      quantity: true,
      total: true,
    },
  },
  payments: {
    orderBy: { createdAt: 'desc' as const },
  },
  coupon: {
    select: { id: true, code: true, type: true, value: true },
  },
  user: {
    select: { id: true, firstName: true, lastName: true, phone: true },
  },
} as const;

@Injectable()
export class AdminOrdersService {
  constructor(
    private prisma: PrismaService,
    private orderStockService: OrderStockService,
  ) {}

  /**
   * List all orders (admin) with filters
   */
  async findAllAdmin(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    userId?: number;
    from?: string;
    to?: string;
  }) {
    const { page = 1, limit = 20, status, search, userId, from, to } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (search) {
      where.orderNumber = { contains: normalizeFa(search) };
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          itemsTotal: true,
          discountAmount: true,
          shippingCost: true,
          finalAmount: true,
          trackingCode: true,
          refundedAt: true,
          createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          _count: { select: { items: true, payments: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Order detail (admin)
   */
  async findOneAdmin(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ADMIN_ORDER_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException('سفارش یافت نشد');
    }

    let addressSnapshot: unknown = order.addressSnapshot;
    try {
      addressSnapshot = JSON.parse(order.addressSnapshot);
    } catch {
      // keep raw string when it is not JSON
    }

    return { ...order, addressSnapshot };
  }

  /**
   * Admin state machine: PAID -> PROCESSING -> SHIPPED -> DELIVERED
   */
  async transition(
    id: number,
    data: { to: string; trackingCode?: string; shippingMethod?: string; note?: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('سفارش یافت نشد');
    }

    const allowed = TRANSITIONS[order.status] || [];
    if (!allowed.includes(data.to)) {
      throw new AppException(
        'ORDER_INVALID_STATE',
        `گذار از وضعیت ${order.status} به ${data.to} مجاز نیست`,
        400,
      );
    }

    const updateData: any = { status: data.to };
    if (data.to === 'PROCESSING' && data.note) {
      updateData.note = data.note;
    }
    if (data.to === 'SHIPPED') {
      updateData.shippedAt = new Date();
      if (data.trackingCode != null) updateData.trackingCode = data.trackingCode;
      if (data.shippingMethod != null) updateData.shippingMethod = data.shippingMethod;
    }
    if (data.to === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    }

    return this.prisma.order.update({
      where: { id },
      data: updateData,
      include: ADMIN_ORDER_INCLUDE,
    });
  }

  /**
   * Set/replace tracking code and shipping method
   */
  async setTracking(id: number, data: { trackingCode: string; shippingMethod?: string }) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('سفارش یافت نشد');
    }
    if (!['PAID', 'PROCESSING', 'SHIPPED'].includes(order.status)) {
      throw new AppException('ORDER_INVALID_STATE', 'وضعیت سفارش اجازه ثبت رهگیری نمی‌دهد', 400);
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        trackingCode: data.trackingCode,
        shippingMethod: data.shippingMethod,
      },
      include: ADMIN_ORDER_INCLUDE,
    });
  }

  /**
   * Cancel a PENDING_PAYMENT order (admin) — releases stock like the user cancel flow
   */
  async cancel(id: number, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('سفارش یافت نشد');
    }

    if (order.status !== 'PENDING_PAYMENT') {
      throw new AppException(
        'ORDER_INVALID_STATE',
        'فقط سفارش‌های در انتظار پرداخت قابل لغو هستند',
        400,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.orderStockService.release(
        tx,
        order.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      );

      if (order.couponId) {
        await tx.couponRedemption.deleteMany({ where: { orderId: order.id } });
      }

      return tx.order.update({
        where: { id },
        data: {
          status: 'CANCELED',
          note: reason ? `${order.note ? order.note + ' | ' : ''}لغو ادمین: ${reason}` : order.note,
        },
        include: ADMIN_ORDER_INCLUDE,
      });
    });
  }

  /**
   * Mark a paid order as refunded (financial refund happens outside the system in MVP).
   * This is a marker only — no stock movement, no status rewrite.
   */
  async markRefunded(id: number, refundNote: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!order) {
      throw new NotFoundException('سفارش یافت نشد');
    }

    const hasSuccessPayment = order.payments.some((p) => p.status === 'SUCCESS');
    if (!hasSuccessPayment) {
      throw new AppException(
        'ORDER_INVALID_STATE',
        'فقط سفارش‌های دارای پرداخت موفق قابل استرداد هستند',
        400,
      );
    }
    if (order.refundedAt) {
      throw new AppException('CONFLICT', 'این سفارش قبلاً استرداد شده است', 409);
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        refundedAt: new Date(),
        refundNote,
      },
      include: ADMIN_ORDER_INCLUDE,
    });
  }
}
