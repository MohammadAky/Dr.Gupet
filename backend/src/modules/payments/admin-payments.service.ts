import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { AppException } from '../../common/filters/all-exceptions.filter';

@Injectable()
export class AdminPaymentsService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
  ) {}

  /**
   * List all payments (admin) with filters
   */
  async findAllAdmin(query: {
    page?: number;
    limit?: number;
    status?: string;
    gateway?: string;
    from?: string;
    to?: string;
  }) {
    const { page = 1, limit = 20, status, gateway, from, to } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (gateway) where.gateway = gateway;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          amount: true,
          gateway: true,
          gatewayRef: true,
          status: true,
          paidAt: true,
          createdAt: true,
          order: { select: { id: true, orderNumber: true, status: true, userId: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Payment detail (admin)
   */
  async findOneAdmin(id: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: true,
            user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('پرداخت یافت نشد');
    }

    return payment;
  }

  /**
   * Reconcile a payment against the gateway (re-runs verify; idempotent)
   */
  async reconcile(id: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException('پرداخت یافت نشد');
    }

    const result = await this.paymentsService.handleCallback(id, { adminReconcile: true });
    return this.prisma.payment
      .findUnique({
        where: { id },
        include: { order: { select: { id: true, orderNumber: true, status: true } } },
      })
      .then((row) => ({ ...result, payment: row }));
  }

  /**
   * Manually mark a non-successful payment as failed
   */
  async markFailed(id: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException('پرداخت یافت نشد');
    }
    if (payment.status === 'SUCCESS') {
      throw new AppException('CONFLICT', 'پرداخت موفق قابل تغییر به ناموفق نیست', 409);
    }

    return this.prisma.payment.update({
      where: { id },
      data: { status: 'FAILED' },
      include: { order: { select: { id: true, orderNumber: true, status: true } } },
    });
  }
}
