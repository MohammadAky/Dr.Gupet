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
      if (
        (row.brandId !== undefined && row.brandName !== undefined) ||
        (row.categoryId !== undefined && row.categoryName !== undefined)
      ) {
        throw new AppException(
          'VALIDATION_ERROR',
          `ردیف ${index + 1}: برای هر مرجع فقط شناسه یا نام را تعیین کنید`,
          400,
        );
      }
      const brandId = row.brandId ?? (row.brandName === undefined ? dto.brandId : undefined);
      const categoryId =
        row.categoryId ?? (row.categoryName === undefined ? dto.categoryId : undefined);
      const petTypeId = row.petTypeId ?? dto.petTypeId;
      if (
        petTypeId === undefined ||
        (brandId === undefined && row.brandName === undefined) ||
        (categoryId === undefined && row.categoryName === undefined)
      ) {
        throw new AppException(
          'VALIDATION_ERROR',
          `ردیف ${index + 1}: برند، دسته‌بندی و نوع حیوان را تعیین کنید`,
          400,
        );
      }
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
        brandId,
        brandName: row.brandName,
        categoryId,
        categoryName: row.categoryName,
        petTypeId,
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
          // Name matching needs the canonical text, not database collation or a
          // slug guess. Keep newly created rows in these transaction-local lists.
          const [brands, categories, petTypes] = await Promise.all([
            tx.brand.findMany({ select: { id: true, name: true, slug: true, isActive: true } }),
            tx.productCategory.findMany({
              select: { id: true, name: true, slug: true, petTypeId: true, isActive: true },
            }),
            tx.petType.findMany({
              where: { id: { in: [...new Set(rows.map((row) => row.petTypeId))] } },
              select: { id: true, isActive: true },
            }),
          ]);
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
          for (const [index, row] of rows.entries()) {
            const invalid = (message: string) =>
              new AppException('VALIDATION_ERROR', `ردیف ${index + 1}: ${message}`, 400);
            const petType = petTypes.find((item) => item.id === row.petTypeId);
            if (!petType || !petType.isActive)
              throw invalid('نوع حیوان معتبر و فعال را انتخاب کنید');
            let brand: (typeof brands)[number] | undefined;
            if (row.brandId !== undefined) {
              brand = brands.find((item) => item.id === row.brandId);
            } else {
              const matches = brands.filter(
                (item) => normalizeFa(item.name).trim() === row.brandName,
              );
              if (matches.length > 1)
                throw invalid('نام برند چند مرجع دارد؛ شناسهٔ دقیق را انتخاب کنید');
              brand = matches[0];
              if (!brand) {
                const slug = slugify(row.brandName!);
                if (!slug) throw invalid('نام برند برای ساخت نشانی معتبر نیست');
                if (brands.some((item) => item.slug === slug))
                  throw new AppException(
                    'CONFLICT',
                    `ردیف ${index + 1}: نشانی برند قبلاً ثبت شده است`,
                    409,
                  );
                brand = await tx.brand.create({
                  data: { name: row.brandName!, slug, isActive: true },
                  select: { id: true, name: true, slug: true, isActive: true },
                });
                brands.push(brand);
              }
            }
            if (!brand || !brand.isActive) throw invalid('برند معتبر و فعال را انتخاب کنید');
            let category: (typeof categories)[number] | undefined;
            if (row.categoryId !== undefined) {
              category = categories.find((item) => item.id === row.categoryId);
            } else {
              const matches = categories.filter(
                (item) =>
                  normalizeFa(item.name).trim() === row.categoryName &&
                  (item.petTypeId === null || item.petTypeId === petType.id),
              );
              if (matches.length > 1)
                throw invalid('نام دسته‌بندی چند مرجع سازگار دارد؛ شناسهٔ دقیق را انتخاب کنید');
              category = matches[0];
              if (!category) {
                const stem = slugify(row.categoryName!);
                if (!stem) throw invalid('نام دسته‌بندی برای ساخت نشانی معتبر نیست');
                const suffix = `-pet-${petType.id}`;
                const slug = [...stem].slice(0, 191 - suffix.length).join('') + suffix;
                if (categories.some((item) => item.slug === slug))
                  throw new AppException(
                    'CONFLICT',
                    `ردیف ${index + 1}: نشانی دسته‌بندی قبلاً ثبت شده است`,
                    409,
                  );
                category = await tx.productCategory.create({
                  data: { name: row.categoryName!, slug, petTypeId: petType.id, isActive: true },
                  select: { id: true, name: true, slug: true, petTypeId: true, isActive: true },
                });
                categories.push(category);
              }
            }
            if (
              !category ||
              !category.isActive ||
              (category.petTypeId !== null && category.petTypeId !== petType.id)
            )
              throw invalid('دسته‌بندی معتبر، فعال و سازگار با نوع حیوان را انتخاب کنید');
            const product = await tx.product.create({
              data: {
                name: row.name,
                slug: row.slug,
                brandId: brand.id,
                categoryId: category.id,
                petTypeId: petType.id,
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
