import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductVariantsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Recalculate minPrice for a product
   * Sets it to the cheapest active variant price
   */
  async recalculateMinPrice(productId: number) {
    const cheapest = await this.prisma.productVariant.findFirst({
      where: {
        productId,
        isActive: true,
      },
      orderBy: { price: 'asc' },
      select: { price: true },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: { minPrice: cheapest?.price || 0 },
    });
  }
}