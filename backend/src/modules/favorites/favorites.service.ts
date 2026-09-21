import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all favorites for current user (paginated product cards)
   */
  async findAll(userId: number, query: PaginationQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        include: {
          product: {
            include: {
              brand: { select: { id: true, name: true } },
              images: { take: 1, select: { url: true } },
              variants: {
                where: { isActive: true },
                select: { price: true, stock: true },
                orderBy: { price: 'asc' },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.favorite.count({ where: { userId } }),
    ]);

    // Transform to product card shape
    const items = favorites
      .filter((fav) => fav.product.isActive) // Skip inactive products
      .map((fav) => {
        const product = fav.product;
        const activeVariants = product.variants;
        const minPrice = activeVariants.length > 0 ? activeVariants[0].price : 0;
        const inStock = activeVariants.some((v) => v.stock > 0);

        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          image: product.images[0]?.url || null,
          minPrice,
          inStock,
          lifeStage: product.lifeStage,
          sizeClass: product.sizeClass,
        };
      });

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Add product to favorites (idempotent)
   */
  async add(userId: number, productId: number) {
    // Check product exists and is active
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('محصول یافت نشد');
    }

    // Idempotent: if already exists, just return ok
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      return { ok: true };
    }

    await this.prisma.favorite.create({
      data: { userId, productId },
    });

    return { ok: true };
  }

  /**
   * Remove product from favorites (idempotent)
   */
  async remove(userId: number, productId: number) {
    // Idempotent: if not exists, just return ok
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (!existing) {
      return { ok: true };
    }

    await this.prisma.favorite.delete({
      where: { userId_productId: { userId, productId } },
    });

    return { ok: true };
  }
}