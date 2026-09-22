import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../common/filters/all-exceptions.filter';

@Injectable()
export class OrderStockService {
  /**
   * Reserve stock atomically for order items
   * Throws OUT_OF_STOCK if any variant has insufficient stock
   */
  async reserve(
    tx: Prisma.TransactionClient,
    items: { variantId: number; quantity: number }[],
  ) {
    for (const item of items) {
      const result = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          stock: { gte: item.quantity },
        },
        data: {
          stock: { decrement: item.quantity },
        },
      });

      if (result.count === 0) {
        throw new AppException('OUT_OF_STOCK', 'موجودی کافی نیست', 400);
      }
    }
  }

  /**
   * Release stock back (for cancel/expiry)
   */
  async release(
    tx: Prisma.TransactionClient,
    orderItems: { variantId: number; quantity: number }[],
  ) {
    for (const item of orderItems) {
      await tx.productVariant.updateMany({
        where: { id: item.variantId },
        data: {
          stock: { increment: item.quantity },
        },
      });
    }
  }
}