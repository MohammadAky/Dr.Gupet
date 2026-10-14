import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { normalizeFa } from '../../common/utils/normalize-fa.util';
import { slugify } from '../../common/utils/slugify.util';
import { ImportProductsDto } from './dto/import-products.dto';

@Injectable()
export class ProductsImportService {
  constructor(private prisma: PrismaService) {}

  async importBatch(input: ImportProductsDto) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new AppException('VALIDATION_ERROR', 'اطلاعات ورود گروهی معتبر نیست', 400);
    }
    const dto = plainToInstance(ImportProductsDto, input);
    const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) {
      throw new AppException(
        'VALIDATION_ERROR',
        'اطلاعات فایل و مرجع‌های ورود گروهی معتبر نیست',
        400,
      );
    }
    const slugs = new Set<string>();
    const skus = new Set<string>();
    const rows = dto.rows.map((row, index) => {
      const name = normalizeFa(row.name).trim();
      const slug = slugify(row.slug?.trim() || name);
      const sku = row.sku?.trim() || `IMPORT-${randomUUID()}`;
      const weightGram = row.weightGram ?? 0;
      const isActive = row.isActive ?? false;
      if (name.length < 2 || !slug || (isActive && weightGram === 0)) {
        throw new AppException(
          'VALIDATION_ERROR',
          `ردیف ${index + 1}: نام و نشانی محصول معتبر و وزن محصول فعال بزرگ‌تر از صفر باشد`,
          400,
        );
      }
      if (slugs.has(slug) || skus.has(sku)) {
        throw new AppException(
          'CONFLICT',
          `ردیف ${index + 1}: نشانی محصول یا شناسهٔ کالا در فایل تکراری است`,
          409,
        );
      }
      slugs.add(slug);
      skus.add(sku);
      return {
        name,
        slug,
        sku,
        weightGram,
        isActive,
        price: row.price,
        stock: row.stock ?? 0,
        compareAtPrice: row.compareAtPrice ?? 0,
        ingredientsText: row.ingredientsText?.trim() || undefined,
        description: row.description?.trim() || undefined,
      };
    });

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [brand, category, petType] = await Promise.all([
            tx.brand.findUnique({ where: { id: dto.brandId }, select: { id: true } }),
            tx.productCategory.findUnique({
              where: { id: dto.categoryId },
              select: { id: true, petTypeId: true },
            }),
            tx.petType.findUnique({ where: { id: dto.petTypeId }, select: { id: true } }),
          ]);
          if (
            !brand ||
            !category ||
            !petType ||
            (category.petTypeId !== null && category.petTypeId !== dto.petTypeId)
          ) {
            throw new AppException(
              'VALIDATION_ERROR',
              'برند، دسته‌بندی و نوع حیوان معتبر و سازگار را انتخاب کنید',
              400,
            );
          }
          const [products, variants] = await Promise.all([
            tx.product.findMany({ where: { slug: { in: [...slugs] } }, select: { slug: true } }),
            tx.productVariant.findMany({
              where: { sku: { in: [...skus] } },
              select: { sku: true },
            }),
          ]);
          if (products.length || variants.length) {
            throw new AppException(
              'CONFLICT',
              'نشانی محصول یا شناسهٔ کالا قبلاً ثبت شده است؛ هیچ ردیفی ثبت نشد',
              409,
            );
          }
          const imported: Array<{ id: number; name: string; slug: string }> = [];
          for (const row of rows) {
            const product = await tx.product.create({
              data: {
                name: row.name,
                slug: row.slug,
                brandId: dto.brandId,
                categoryId: dto.categoryId,
                petTypeId: dto.petTypeId,
                ingredientsText: row.ingredientsText,
                description: row.description,
                isActive: row.isActive,
                minPrice: row.price,
                variants: {
                  create: {
                    sku: row.sku,
                    weightGram: row.weightGram,
                    price: row.price,
                    stock: row.stock,
                    compareAtPrice: row.compareAtPrice,
                    isActive: true,
                  },
                },
              },
              select: { id: true, name: true, slug: true },
            });
            imported.push(product);
          }
          return { imported: imported.length, products: imported };
        },
        { maxWait: 5000, timeout: 15000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2003'].includes(error.code)
      ) {
        throw new AppException(
          'CONFLICT',
          'شناسهٔ تکراری یا تغییر مرجع هم‌زمان؛ هیچ ردیفی ثبت نشد',
          409,
        );
      }
      throw error;
    }
  }
}
