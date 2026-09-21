import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeFa } from '../../common/utils/normalize-fa.util';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find products with filtering, search, sorting, pagination
   */
  async findAll(query: PaginationQueryDto & {
    q?: string;
    petTypeId?: number;
    categorySlug?: string;
    brandId?: number;
    lifeStage?: string;
    sizeClass?: string;
    tagIds?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    sort?: string;
  }) {
    const { page = 1, limit = 20, q, petTypeId, categorySlug, brandId, lifeStage, sizeClass, tagIds, minPrice, maxPrice, inStock, sort } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
      variants: { some: { isActive: true } }, // At least one active variant
    };

    // Search by name (normalized Persian)
    if (q) {
      where.name = { contains: normalizeFa(q), mode: 'insensitive' };
    }

    // Filter by pet type
    if (petTypeId) {
      where.petTypeId = petTypeId;
    }

    // Filter by category (include children)
    if (categorySlug) {
      const category = await this.prisma.productCategory.findUnique({
        where: { slug: categorySlug },
      });

      if (category) {
        // Get all child category IDs
        const childIds = await this.getChildCategoryIds(category.id);
        where.categoryId = { in: [category.id, ...childIds] };
      }
    }

    // Filter by brand
    if (brandId) {
      where.brandId = brandId;
    }

    // Filter by life stage
    if (lifeStage) {
      where.lifeStage = { in: [lifeStage, 'ALL'] };
    }

    // Filter by size class
    if (sizeClass) {
      where.sizeClass = { in: [sizeClass, 'ALL'] };
    }

    // Filter by tags (product must have ALL given tags)
    if (tagIds) {
      const ids = tagIds.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        where.tags = {
          every: {
            tagId: { in: ids },
            kind: 'SUITABLE_FOR',
          },
        };
      }
    }

    // Filter by price range (any variant in range)
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.variants = {
        ...where.variants,
        some: {
          ...where.variants.some,
          price: {
            ...(minPrice !== undefined && { gte: minPrice }),
            ...(maxPrice !== undefined && { lte: maxPrice }),
          },
        },
      };
    }

    // Filter by in stock
    if (inStock) {
      where.variants = {
        ...where.variants,
        some: {
          ...where.variants.some,
          stock: { gt: 0 },
        },
      };
    }

    // Build order by
    let orderBy: any = { createdAt: 'desc' }; // default: newest
    if (sort === 'price_asc') orderBy = { minPrice: 'asc' };
    if (sort === 'price_desc') orderBy = { minPrice: 'desc' };

    // Execute queries in parallel
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          brand: { select: { id: true, name: true } },
          images: { take: 1, select: { url: true } },
          variants: {
            where: { isActive: true },
            select: { price: true, stock: true },
            orderBy: { price: 'asc' },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ]);

    // Transform to product card shape
    const items = products.map((product) => {
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
   * Get product detail by slug
   */
  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug, isActive: true },
      include: {
        brand: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
        petType: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true, sortOrder: true } },
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            sku: true,
            weightGram: true,
            price: true,
            compareAtPrice: true,
            stock: true,
          },
          orderBy: { weightGram: 'asc' },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, slug: true, type: true } },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('محصول یافت نشد');
    }

    // Transform variants to hide stock numbers
    const variants = product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      weightGram: v.weightGram,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      inStock: v.stock > 0,
      lowStock: v.stock > 0 && v.stock <= 5,
    }));

    return {
      ...product,
      variants,
      tags: product.tags.map((pt) => pt.tag),
    };
  }

  /**
   * Get all child category IDs recursively
   */
  private async getChildCategoryIds(parentId: number): Promise<number[]> {
    const children = await this.prisma.productCategory.findMany({
      where: { parentId, isActive: true },
      select: { id: true },
    });

    let ids = children.map((c) => c.id);

    for (const child of children) {
      const grandChildren = await this.getChildCategoryIds(child.id);
      ids = [...ids, ...grandChildren];
    }

    return ids;
  }
}