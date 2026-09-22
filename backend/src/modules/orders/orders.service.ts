import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { OrderStockService } from './order-stock.service';
import { generateOrderNumber } from '../../common/utils/order-number.util';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
    private couponsService: CouponsService,
    private orderStockService: OrderStockService,
    private configService: ConfigService,
  ) {}

  /**
   * Checkout from cart
   */
  async checkout(userId: number, data: { addressId: number; couponCode?: string; note?: string }) {
    // 1. Load cart
    const cart = await this.cartService.getCart(userId);
    if (cart.items.length === 0) {
      throw new AppException('CART_EMPTY', 'سبد خرید خالی است', 400);
    }

    // 2. Load and validate address
    const address = await this.prisma.address.findUnique({
      where: { id: data.addressId },
    });

    if (!address || address.userId !== userId) {
      throw new NotFoundException('آدرس یافت نشد');
    }

    // Build address snapshot
    const addressSnapshot = {
      title: address.title,
      receiverName: address.receiverName,
      receiverPhone: address.receiverPhone,
      province: address.province,
      city: address.city,
      fullAddress: address.fullAddress,
      postalCode: address.postalCode,
    };

    // 3. Validate all items are still available
    const cartItems = await this.prisma.cartItem.findMany({
      where: { cart: { userId } },
      include: {
        variant: {
          include: { product: { select: { isActive: true } } },
        },
      },
    });

    for (const item of cartItems) {
      if (!item.variant.isActive || !item.variant.product.isActive) {
        throw new AppException('VARIANT_UNAVAILABLE', 'یک یا چند محصول موجود نیست', 400);
      }
    }

    // 4. Calculate itemsTotal
    const itemsTotal = cartItems.reduce(
      (sum, item) => sum + item.variant.price * item.quantity,
      0,
    );

    // 5. Validate coupon if provided
    let discountAmount = 0;
    let couponId: number | null = null;

    if (data.couponCode) {
      const result = await this.couponsService.evaluate(
        data.couponCode.toUpperCase(),
        userId,
        itemsTotal,
      );
      discountAmount = result.discountAmount;

      // Get coupon ID for recording
      const coupon = await this.prisma.coupon.findUnique({
        where: { code: data.couponCode.toUpperCase() },
      });
      couponId = coupon?.id || null;
    }

    // 6. Calculate shipping
    const freeShippingThreshold = this.configService.get<number>('app.freeShippingThreshold') || 1500000;
    const shippingFlatCost = this.configService.get<number>('app.shippingFlatCost') || 50000;
    const shippingCost = itemsTotal >= freeShippingThreshold ? 0 : shippingFlatCost;

    // 7. Calculate finalAmount
    const finalAmount = Math.max(0, itemsTotal - discountAmount + shippingCost);

    // 8. Reserve stock and create order in transaction
    return this.prisma.$transaction(async (tx) => {
      // Reserve stock
      await this.orderStockService.reserve(
        tx,
        cartItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      );

      // Create order
      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          addressSnapshot: addressSnapshot as any,
          itemsTotal,
          discountAmount,
          shippingCost,
          finalAmount,
          couponId,
          status: OrderStatus.PENDING_PAYMENT,
          note: data.note,
        },
      });

      // Create order items (snapshots)
      await tx.orderItem.createMany({
        data: cartItems.map((item) => ({
          orderId: order.id,
          variantId: item.variantId,
          productName: item.variant.product.name || 'Product',
          weightGram: item.variant.weightGram,
          unitPrice: item.variant.price,
          quantity: item.quantity,
          total: item.variant.price * item.quantity,
        })),
      });

      // Record coupon redemption if coupon used
      if (couponId) {
        await tx.couponRedemption.create({
          data: {
            couponId,
            userId,
            orderId: order.id,
            amount: discountAmount,
          },
        });
      }

      // Clear cart items
      await tx.cartItem.deleteMany({
        where: { cart: { userId } },
      });

      return order;
    });
  }

  /**
   * Get my orders (paginated)
   */
  async findAll(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: {
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
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { status: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { userId } }),
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
   * Get single order by ID
   */
  async findOne(userId: number, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('سفارش یافت نشد');
    }

    return order;
  }

  /**
   * Cancel order (only PENDING_PAYMENT)
   */
  async cancel(userId: number, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException('سفارش یافت نشد');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new AppException('ORDER_INVALID_STATE', 'فقط سفارش‌های در انتظار پرداخت قابل لغو هستند', 400);
    }

    return this.prisma.$transaction(async (tx) => {
      // Release stock
      await this.orderStockService.release(
        tx,
        order.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      );

      // Delete coupon redemption if exists
      if (order.couponId) {
        await tx.couponRedemption.deleteMany({
          where: { orderId: order.id },
        });
      }

      // Update order status
      return tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELED },
      });
    });
  }

  /**
   * Expire old pending payment orders (runs every 5 minutes)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expirePendingOrders() {
    const expireMinutes = this.configService.get<number>('app.orderExpireMinutes') || 30;
    const cutoff = new Date(Date.now() - expireMinutes * 60 * 1000);

    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        createdAt: { lt: cutoff },
      },
      include: { items: true },
    });

    for (const order of expiredOrders) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Release stock
          await this.orderStockService.release(
            tx,
            order.items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
            })),
          );

          // Delete coupon redemption
          if (order.couponId) {
            await tx.couponRedemption.deleteMany({
              where: { orderId: order.id },
            });
          }

          // Update order status
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.CANCELED },
          });
        });
      } catch (error) {
        console.error(`Failed to expire order ${order.orderNumber}:`, error);
      }
    }

    if (expiredOrders.length > 0) {
      console.log(`Expired ${expiredOrders.length} pending payment orders`);
    }
  }
}