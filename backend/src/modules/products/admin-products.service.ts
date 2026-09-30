import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductVariantsService } from './product-variants.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { slugify } from '../../common/utils/slugify.util';
import { normalizeFa } from '../../common/utils/normalize-fa.util';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateVariantDto,
  UpdateVariantDto,
} from './dto/admin-product.dto';

@Injectable()
export class AdminProductsService {
  constructor(
    private prisma: PrismaService,
    private productVariantsService: ProductVariantsService,
  ) {}

  private async assertReferences(data: {
    brandId?: number;
    categoryId?: number;
    petTypeId?: number;
  }) {
    if (data.brandId != null) {
      const brand = await this.prisma.brand.findUnique({ where: { id: data.brandId } });
      if (!brand) throw new AppException('NOT_FOUND', 'برند یافت نشد', 404);
    }
    if (data.categoryId != null) {
      const category = await this.prisma.productCategory.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) throw new AppException('NOT_FOUND', 'دسته‌بندی یافت نشد', 404);
    }
    if (data.petTypeId != null) {
      const petType = await this.prisma.petType.findUnique({ where: { id: data.petTypeId } });
      if (!petType) throw new AppException('NOT_FOUND', 'نوع حیوان یافت نشد', 404);
    }
  }

  /**
   * List products (admin): includes inactive, with variant/stock summary
   */
  async findAllAdmin(query: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    brandId?: number;
    categoryId?: number;
    petTypeId?: number;
  }) {
    const { page = 1, limit = 20, search, isActive, brandId, categoryId, petTypeId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: normalizeFa(search), mode: 'insensitive' } },
        { slug: { contains: normalizeFa(search), mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) where.isActive = isActive;
    if (brandId) where.brandId = brandId;
    if (categoryId) where.categoryId = categoryId;
    if (petTypeId) where.petTypeId = petTypeId;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          lifeStage: true,
          sizeClass: true,
          isActive: true,
          minPrice: true,
          createdAt: true,
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          petType: { select: { id: true, name: true } },
          variants: {
            select: { id: true, stock: true, isActive: true },
          },
          _count: { select: { variants: true, images: true, favorites: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((product) => ({
        ...product,
        totalStock: product.variants
          .filter((variant) => variant.isActive)
          .reduce((sum, variant) => sum + variant.stock, 0),
        variants: undefined,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Product detail (admin): everything including inactive rows
   */
  async findOneAdmin(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        petType: true,
        variants: { orderBy: { weightGram: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
        tags: { include: { tag: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('محصول یافت نشد');
    }

    return product;
  }

  async create(dto: CreateProductDto) {
    await this.assertReferences(dto);

    const slug = slugify(dto.slug || dto.name);
    if (!slug) {
      throw new AppException('VALIDATION_ERROR', 'نام محصول برای ساخت slug معتبر نیست', 400);
    }
    const slugExists = await this.prisma.product.findUnique({ where: { slug } });
    if (slugExists) {
      throw new AppException('CONFLICT', 'slug محصول تکراری است', 409);
    }

    return this.prisma.product.create({
      data: {
        name: normalizeFa(dto.name),
        slug,
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        petTypeId: dto.petTypeId,
        lifeStage: dto.lifeStage ?? 'ALL',
        sizeClass: dto.sizeClass ?? 'ALL',
        neuterSuitability: dto.neuterSuitability ?? 'ANY',
        ingredientsText: dto.ingredientsText,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: number, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('محصول یافت نشد');
    }
    await this.assertReferences(dto);

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name != null ? normalizeFa(dto.name) : undefined,
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        petTypeId: dto.petTypeId,
        lifeStage: dto.lifeStage,
        sizeClass: dto.sizeClass,
        neuterSuitability: dto.neuterSuitability,
        ingredientsText: dto.ingredientsText,
        description: dto.description,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Delete product: hard-delete when it has never been ordered;
   * otherwise deactivate to keep order history intact.
   */
  async remove(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: { select: { id: true } } },
    });
    if (!product) {
      throw new NotFoundException('محصول یافت نشد');
    }

    const variantIds = product.variants.map((variant) => variant.id);
    const soldCount =
      variantIds.length > 0
        ? await this.prisma.orderItem.count({ where: { variantId: { in: variantIds } } })
        : 0;

    if (soldCount > 0) {
      const updated = await this.prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      return { deleted: false, deactivated: true, product: updated };
    }

    await this.prisma.product.delete({ where: { id } });
    return { deleted: true, deactivated: false };
  }

  // -------------------------------------------------------------------
  // Variants
  // -------------------------------------------------------------------

  async createVariant(productId: number, dto: CreateVariantDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('محصول یافت نشد');
    }

    const skuExists = await this.prisma.productVariant.findUnique({ where: { sku: dto.sku } });
    if (skuExists) {
      throw new AppException('CONFLICT', 'SKU تکراری است', 409);
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        sku: dto.sku,
        weightGram: dto.weightGram,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        stock: dto.stock ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.productVariantsService.recalculateMinPrice(productId);
    return variant;
  }

  async updateVariant(variantId: number, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) {
      throw new NotFoundException('واریانت یافت نشد');
    }

    if (dto.sku && dto.sku !== variant.sku) {
      const skuExists = await this.prisma.productVariant.findUnique({ where: { sku: dto.sku } });
      if (skuExists) {
        throw new AppException('CONFLICT', 'SKU تکراری است', 409);
      }
    }

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        sku: dto.sku,
        weightGram: dto.weightGram,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        stock: dto.stock,
        isActive: dto.isActive,
      },
    });

    await this.productVariantsService.recalculateMinPrice(variant.productId);
    return updated;
  }

  async removeVariant(variantId: number) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!variant) {
      throw new NotFoundException('واریانت یافت نشد');
    }

    if (variant._count.orderItems > 0) {
      const updated = await this.prisma.productVariant.update({
        where: { id: variantId },
        data: { isActive: false },
      });
      return { deleted: false, deactivated: true, variant: updated };
    }

    await this.prisma.productVariant.delete({ where: { id: variantId } });
    await this.productVariantsService.recalculateMinPrice(variant.productId);
    return { deleted: true, deactivated: false };
  }

  // -------------------------------------------------------------------
  // Images & tags
  // -------------------------------------------------------------------

  async addImage(productId: number, url: string, sortOrder = 0) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('محصول یافت نشد');
    }
    return this.prisma.productImage.create({ data: { productId, url, sortOrder } });
  }

  async removeImage(imageId: number) {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) {
      throw new NotFoundException('تصویر یافت نشد');
    }
    await this.prisma.productImage.delete({ where: { id: imageId } });
    return { deleted: true };
  }

  /**
   * Replace product tags: CONTAINS must be ALLERGEN tags,
   * SUITABLE_FOR must be DIET tags (service-layer invariant).
   */
  async setTags(productId: number, data: { contains?: number[]; suitableFor?: number[] }) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('محصول یافت نشد');
    }

    const contains = data.contains ?? [];
    const suitableFor = data.suitableFor ?? [];
    const tagIds = [...new Set([...contains, ...suitableFor])];

    const tags = tagIds.length
      ? await this.prisma.tag.findMany({ where: { id: { in: tagIds } } })
      : [];
    const tagById = new Map(tags.map((tag) => [tag.id, tag]));

    for (const tagId of contains) {
      const tag = tagById.get(tagId);
      if (!tag || tag.type !== 'ALLERGEN') {
        throw new AppException('VALIDATION_ERROR', `تگ ${tagId} از نوع ALLERGEN نیست`, 400);
      }
    }
    for (const tagId of suitableFor) {
      const tag = tagById.get(tagId);
      if (!tag || tag.type !== 'DIET') {
        throw new AppException('VALIDATION_ERROR', `تگ ${tagId} از نوع DIET نیست`, 400);
      }
    }

    await this.prisma.$transaction([
      this.prisma.productTag.deleteMany({ where: { productId } }),
      this.prisma.productTag.createMany({
        data: [
          ...contains.map((tagId) => ({ productId, tagId, kind: 'CONTAINS' })),
          ...suitableFor.map((tagId) => ({ productId, tagId, kind: 'SUITABLE_FOR' })),
        ],
      }),
    ]);

    return this.prisma.product.findUnique({
      where: { id: productId },
      include: { tags: { include: { tag: true } } },
    });
  }
}
