import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/filters/all-exceptions.filter';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validate coupon and preview discount
   * Does NOT record anything - just validates and calculates
   */
  async validate(code: string, userId: number, itemsTotal: number) {
    const result = await this.evaluate(code, userId, itemsTotal);
    return result;
  }

  /**
   * Evaluate coupon - single reusable validation function
   * Used by validate endpoint and checkout
   */
  async evaluate(
    code: string,
    userId: number,
    itemsTotal: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;

    // 1. Find coupon
    const coupon = await client.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon || !coupon.isActive) {
      throw new AppException('COUPON_INVALID', 'کد تخفیف معتبر نیست', 400);
    }

    // 2. Check date validity
    const now = new Date();
    if (coupon.startAt && coupon.startAt > now) {
      throw new AppException('COUPON_EXPIRED', 'کد تخفیف هنوز فعال نشده است', 400);
    }
    if (coupon.endAt && coupon.endAt < now) {
      throw new AppException('COUPON_EXPIRED', 'کد تخفیف منقضی شده است', 400);
    }

    // 3. Check minimum order amount
    if (coupon.minOrderAmount && itemsTotal < coupon.minOrderAmount) {
      throw new AppException(
        'COUPON_MIN_AMOUNT',
        `حداقل مبلغ سفارش ${coupon.minOrderAmount.toLocaleString('fa-IR')} تومان است`,
        400,
      );
    }

    // 4. Check total redemption limit
    if (coupon.totalLimit) {
      const totalRedemptions = await client.couponRedemption.count({
        where: { couponId: coupon.id },
      });

      if (totalRedemptions >= coupon.totalLimit) {
        throw new AppException('COUPON_LIMIT_REACHED', 'حد استفاده از این کد تخفیف رسیده است', 400);
      }
    }

    // 5. Check per-user limit
    if (coupon.perUserLimit) {
      const userRedemptions = await client.couponRedemption.count({
        where: { couponId: coupon.id, userId },
      });

      if (userRedemptions >= coupon.perUserLimit) {
        throw new AppException('COUPON_LIMIT_REACHED', 'شما قبلاً از این کد تخفیف استفاده کرده‌اید', 400);
      }
    }

    // 6. Calculate discount
    let discount = 0;

    if (coupon.type === 'PERCENT') {
      discount = Math.floor((itemsTotal * coupon.value) / 100);
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      // FIXED
      discount = coupon.value;
    }

    // Discount cannot exceed itemsTotal
    discount = Math.min(discount, itemsTotal);

    return {
      code: coupon.code,
      discountAmount: discount,
      finalAmount: itemsTotal - discount,
    };
  }
}