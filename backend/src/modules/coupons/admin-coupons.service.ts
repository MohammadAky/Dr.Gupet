import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { CreateCouponDto, UpdateCouponDto } from './dto/admin-coupon.dto';

@Injectable()
export class AdminCouponsService {
  constructor(private prisma: PrismaService) {}

  private validateDiscountRules(type: string, value: number) {
    if (type === 'PERCENT' && value > 100) {
      throw new AppException('VALIDATION_ERROR', 'درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد', 400);
    }
  }

  /**
   * List coupons (admin) with usage counts
   */
  async findAllAdmin(query: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }) {
    const { page = 1, limit = 20, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) where.code = { contains: search.toUpperCase(), mode: 'insensitive' };
    if (isActive !== undefined) where.isActive = isActive;

    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        include: { _count: { select: { redemptions: true, orders: true } } },
        skip,
        take: limit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return {
      data: coupons,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneAdmin(id: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        _count: { select: { redemptions: true, orders: true } },
        redemptions: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            createdAt: true,
            user: { select: { id: true, phone: true, firstName: true, lastName: true } },
            order: { select: { id: true, orderNumber: true, status: true } },
          },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('کوپن یافت نشد');
    }

    return coupon;
  }

  async create(dto: CreateCouponDto) {
    this.validateDiscountRules(dto.type, dto.value);

    const code = dto.code.toUpperCase();
    const exists = await this.prisma.coupon.findUnique({ where: { code } });
    if (exists) {
      throw new AppException('CONFLICT', 'کد کوپن تکراری است', 409);
    }

    return this.prisma.coupon.create({
      data: {
        code,
        type: dto.type,
        value: dto.value,
        minOrderAmount: dto.minOrderAmount,
        maxDiscount: dto.maxDiscount,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        totalLimit: dto.totalLimit,
        perUserLimit: dto.perUserLimit,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: number, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('کوپن یافت نشد');
    }

    this.validateDiscountRules(dto.type ?? coupon.type, dto.value ?? coupon.value);

    return this.prisma.coupon.update({
      where: { id },
      data: {
        type: dto.type,
        value: dto.value,
        minOrderAmount: dto.minOrderAmount,
        maxDiscount: dto.maxDiscount,
        startAt: dto.startAt === undefined ? undefined : dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt === undefined ? undefined : dto.endAt ? new Date(dto.endAt) : null,
        totalLimit: dto.totalLimit,
        perUserLimit: dto.perUserLimit,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Delete: hard-delete when unused; otherwise deactivate to protect history
   */
  async remove(id: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { redemptions: true } } },
    });

    if (!coupon) {
      throw new NotFoundException('کوپن یافت نشد');
    }

    if (coupon._count.redemptions > 0) {
      const updated = await this.prisma.coupon.update({
        where: { id },
        data: { isActive: false },
      });
      return { deleted: false, deactivated: true, coupon: updated };
    }

    await this.prisma.coupon.delete({ where: { id } });
    return { deleted: true, deactivated: false };
  }
}
