import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/filters/all-exceptions.filter';
import { normalizeFa } from '../../common/utils/normalize-fa.util';
import { slugify } from '../../common/utils/slugify.util';
import { ProductsImportService } from './products-import.service';
import { AdminProductsService } from './admin-products.service';
import { SyncProductsDto, SyncProductRowDto } from './dto/sync-products.dto';
import { exportColumns, productExportCsv, ExportColumn } from './product-export';

type Product = Prisma.ProductGetPayload<{ include: { variants: true } }>;
type Change = { field: string; before: unknown; after: unknown };
type Review = {
  line: number;
  action: 'create' | 'update' | 'unchanged' | 'add-variant';
  data: SyncProductRowDto;
  changes: Change[];
};
type Group = {
  product: Product;
  patch: Prisma.ProductUncheckedUpdateInput;
  variants: Map<number, Prisma.ProductVariantUpdateInput>;
  additions: SyncProductRowDto[];
  keys: Map<string, unknown>;
};
const metaKeys = [
  'name',
  'brandId',
  'categoryId',
  'petTypeId',
  'ingredientsText',
  'description',
  'isActive',
] as const;
const variantKeys = ['price', 'stock', 'weightGram', 'compareAtPrice'] as const;
const invalid = (message: string, line?: number) =>
  new AppException('VALIDATION_ERROR', (line ? `ردیف ${line}: ` : '') + message, 400);
const stale = () =>
  new AppException(
    'CONFLICT',
    'موجودی یا اطلاعات محصول تغییر کرده است؛ خروجی تازه بگیرید و دوباره بررسی کنید',
    409,
  );

@Injectable()
export class ProductsSyncService {
  constructor(
    private prisma: PrismaService,
    private products: AdminProductsService,
  ) {}

  async exportCsv(filters: {
    search?: string;
    isActive?: boolean;
    brandId?: number;
    categoryId?: number;
    petTypeId?: number;
    columns?: string;
  }) {
    const columns = exportColumns(filters.columns);
    const where: Prisma.ProductWhereInput = {};
    if (filters.search)
      where.OR = [
        { name: { contains: normalizeFa(filters.search) } },
        { slug: { contains: normalizeFa(filters.search) } },
      ];
    for (const key of ['isActive', 'brandId', 'categoryId', 'petTypeId'] as const)
      if (filters[key] !== undefined) Object.assign(where, { [key]: filters[key] });
    const products = await this.prisma.product.findMany({
      where,
      include: { variants: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'asc' },
      take: 501,
    });
    const count = products.reduce((sum, p) => sum + Math.max(1, p.variants.length), 0);
    if (count > 500) throw invalid('خروجی بیش از ۵۰۰ ردیف است؛ فیلترها را محدود کنید');
    const rows = products.flatMap((product) =>
      (product.variants.length ? product.variants : [null]).map(
        (variant) =>
          ({
            productId: product.id,
            variantId: variant?.id ?? '',
            sku: variant?.sku ?? '',
            name: product.name,
            slug: product.slug,
            brandId: product.brandId,
            categoryId: product.categoryId,
            petTypeId: product.petTypeId,
            price: variant?.price ?? '',
            stock: variant?.stock ?? '',
            weightGram: variant?.weightGram ?? '',
            compareAtPrice: variant?.compareAtPrice ?? '',
            isActive: product.isActive ? 'T' : 'F',
            ingredientsText: product.ingredientsText,
            description: product.description,
            expectedStock: variant?.stock ?? '',
            expectedUpdatedAt: product.updatedAt.toISOString(),
          }) as Record<ExportColumn, unknown>,
      ),
    );
    return productExportCsv(rows, columns);
  }

  async synchronize(input: SyncProductsDto, preview: boolean) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw invalid('اطلاعات CSV معتبر نیست');
    const dto = plainToInstance(SyncProductsDto, input);
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length)
      throw invalid('اطلاعات CSV معتبر نیست');
    const rows = dto.rows.map((row) => {
      const copy = { ...row };
      for (const key of [
        'sku',
        'slug',
        'name',
        'brandName',
        'categoryName',
        'ingredientsText',
        'description',
      ] as const) {
        if (copy[key] !== undefined) {
          copy[key] = copy[key]!.trim();
          if (!copy[key]) delete copy[key];
        }
      }
      for (const key of ['name', 'brandName', 'categoryName'] as const)
        if (copy[key] !== undefined) copy[key] = normalizeFa(copy[key]!).trim();
      if (row.name !== undefined && (copy.name?.length ?? 0) < 2)
        throw invalid('نام محصول باید دست‌کم دو نویسه باشد');
      return copy;
    });
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const targets: Array<{ productId: number; variantId?: number } | null> = [];
          for (const [i, row] of rows.entries()) {
            const variant = row.variantId
              ? await tx.productVariant.findUnique({ where: { id: row.variantId } })
              : row.sku
                ? await tx.productVariant.findUnique({ where: { sku: row.sku } })
                : null;
            if (row.variantId && !variant) throw invalid('شناسهٔ گزینهٔ محصول پیدا نشد', i + 2);
            if (variant && row.productId !== undefined && variant.productId !== row.productId)
              throw invalid('شناسه‌های محصول و گزینه سازگار نیستند', i + 2);
            if (variant && row.sku !== undefined && variant.sku !== row.sku)
              throw invalid('شناسهٔ کالا برای گزینهٔ موجود قابل تغییر نیست', i + 2);
            const productId = variant?.productId ?? row.productId;
            if (productId !== undefined) {
              if (
                !(await tx.product.findUnique({ where: { id: productId }, select: { id: true } }))
              )
                throw invalid('شناسهٔ محصول پیدا نشد', i + 2);
              targets.push({ productId, variantId: variant?.id });
            } else targets.push(null);
          }
          const ids = [...new Set(targets.flatMap((t) => (t ? [t.productId] : [])))].sort(
            (a, b) => a - b,
          );
          if (ids.length) {
            await tx.$queryRaw(
              Prisma.sql`SELECT id FROM Product WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`,
            );
            await tx.$queryRaw(
              Prisma.sql`SELECT id FROM ProductVariant WHERE productId IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`,
            );
          }
          const current = await tx.product.findMany({
            where: { id: { in: ids } },
            include: { variants: true },
          });
          const groups = new Map<number, Group>();
          const claimedVariants = new Set<number>();
          const newSkus = new Set<string>();
          const newSlugs = new Set<string>();
          const reviews: Review[] = [];
          const creates: SyncProductRowDto[] = [];
          const [brands, categories, petTypes] = await Promise.all([
            tx.brand.findMany(),
            tx.productCategory.findMany(),
            tx.petType.findMany(),
          ]);
          // Include planned references when checking later creation rows, without
          // writing anything during preview or exposing synthetic IDs to updates.
          const plannedBrands = [...brands];
          const plannedCategories = [...categories];
          for (const [i, row] of rows.entries()) {
            const line = i + 2;
            const target = targets[i];
            const data = { ...row };
            const changes: Change[] = [];
            if (!target) {
              if (
                !row.name ||
                row.price === undefined ||
                (!row.brandId && !row.brandName) ||
                (!row.categoryId && !row.categoryName) ||
                !row.petTypeId
              )
                throw invalid(
                  'محصول جدید به نام، قیمت، برند، دسته‌بندی و نوع حیوان نیاز دارد',
                  line,
                );
              const slug = slugify(row.slug || row.name);
              if (
                !slug ||
                newSlugs.has(slug) ||
                (await tx.product.findUnique({ where: { slug }, select: { id: true } }))
              )
                throw invalid('نشانی محصول جدید تکراری یا نامعتبر است', line);
              if (row.sku && newSkus.has(row.sku))
                throw invalid('شناسهٔ کالای جدید در فایل تکراری است', line);
              newSlugs.add(slug);
              if (row.sku) newSkus.add(row.sku);
              const pet = petTypes.find((p) => p.id === row.petTypeId && p.isActive);
              if (!pet) throw invalid('نوع حیوان فعال را تعیین کنید', line);
              for (const kind of ['brand', 'category'] as const) {
                const idKey = kind === 'brand' ? 'brandId' : 'categoryId',
                  nameKey = kind === 'brand' ? 'brandName' : 'categoryName';
                if (row[idKey] !== undefined && row[nameKey] !== undefined)
                  throw invalid('برای هر مرجع فقط نام یا شناسه تعیین کنید', line);
                const list = kind === 'brand' ? plannedBrands : plannedCategories;
                const matches = list.filter(
                  (r) =>
                    normalizeFa(r.name).trim() === row[nameKey] &&
                    (!('petTypeId' in r) || r.petTypeId === null || r.petTypeId === row.petTypeId),
                );
                if (row[idKey] === undefined && matches.length > 1)
                  throw invalid('نام مرجع چند نتیجه دارد؛ شناسهٔ دقیق را تعیین کنید', line);
                const reference =
                  row[idKey] !== undefined ? list.find((r) => r.id === row[idKey]) : matches[0];
                if ((row[idKey] !== undefined && !reference) || (reference && !reference.isActive))
                  throw invalid('مرجع محصول جدید معتبر و فعال نیست', line);
                if (
                  reference &&
                  'petTypeId' in reference &&
                  reference.petTypeId !== null &&
                  reference.petTypeId !== row.petTypeId
                )
                  throw invalid('دسته‌بندی با نوع حیوان سازگار نیست', line);
                if (!reference) {
                  const stem = slugify(row[nameKey]!);
                  const suffix = kind === 'category' ? `-pet-${row.petTypeId}` : '';
                  const referenceSlug = [...stem].slice(0, 191 - suffix.length).join('') + suffix;
                  if (!stem || list.some((r) => r.slug === referenceSlug))
                    throw invalid('نام یا نشانی مرجع جدید نامعتبر یا تکراری است', line);
                  if (kind === 'brand')
                    plannedBrands.push({
                      ...brands[0],
                      id: -plannedBrands.length - 1,
                      name: row[nameKey]!,
                      slug: referenceSlug,
                      isActive: true,
                    });
                  else
                    plannedCategories.push({
                      ...categories[0],
                      id: -plannedCategories.length - 1,
                      name: row[nameKey]!,
                      slug: referenceSlug,
                      petTypeId: row.petTypeId!,
                      isActive: true,
                    });
                }
              }
              if (row.isActive && !row.weightGram)
                throw invalid('محصول منتشرشده به وزن بیشتر از صفر نیاز دارد', line);
              creates.push(data);
              reviews.push({
                line,
                action: 'create',
                data,
                changes: Object.entries(data).map(([field, after]) => ({
                  field,
                  before: null,
                  after,
                })),
              });
              continue;
            }
            const product = current.find((p) => p.id === target.productId);
            if (!product) throw stale();
            const variant = target.variantId
              ? product.variants.find((v) => v.id === target.variantId)
              : undefined;
            if (target.variantId && !variant) throw stale();
            if (row.sku && variant && variant.sku !== row.sku) throw stale();
            if (!preview && !row.expectedUpdatedAt)
              throw invalid('ابتدا پیش‌نمایش اطلاعات محصول را دریافت کنید', line);
            if (row.slug && slugify(row.slug) !== product.slug)
              throw invalid('نشانی محصول موجود قابل تغییر نیست', line);
            if (
              row.expectedUpdatedAt &&
              Date.parse(row.expectedUpdatedAt) !== product.updatedAt.getTime()
            )
              throw stale();
            if (variant && row.stock !== undefined) {
              if (row.expectedStock !== undefined && row.expectedStock !== variant.stock)
                throw stale();
              if (!preview && row.expectedStock === undefined)
                throw invalid('ابتدا پیش‌نمایش تغییرات را دریافت کنید', line);
              data.expectedStock = variant.stock;
            }
            data.productId = product.id;
            data.expectedUpdatedAt = product.updatedAt.toISOString();
            let group = groups.get(product.id);
            if (!group) {
              group = { product, patch: {}, variants: new Map(), additions: [], keys: new Map() };
              groups.set(product.id, group);
            }
            for (const kind of ['brand', 'category'] as const) {
              const idKey = kind === 'brand' ? 'brandId' : 'categoryId',
                nameKey = kind === 'brand' ? 'brandName' : 'categoryName';
              if (row[idKey] !== undefined && row[nameKey] !== undefined)
                throw invalid('برای هر مرجع فقط نام یا شناسه تعیین کنید', line);
              if (row[nameKey] !== undefined) {
                const list = kind === 'brand' ? brands : categories;
                const matches = list.filter(
                  (ref) =>
                    normalizeFa(ref.name).trim() === normalizeFa(row[nameKey]!).trim() &&
                    (!('petTypeId' in ref) ||
                      ref.petTypeId === null ||
                      ref.petTypeId === (row.petTypeId ?? product.petTypeId)),
                );
                if (matches.length !== 1)
                  throw invalid('نام مرجع موجود یکتا نیست؛ شناسه را تعیین کنید', line);
                data[idKey] = matches[0].id;
                delete data[nameKey];
              }
            }
            for (const key of metaKeys) {
              if (data[key] === undefined) continue;
              let after: unknown = data[key];
              if (key === 'name') after = normalizeFa(String(after)).trim();
              if ((key === 'description' || key === 'ingredientsText') && after === '__CLEAR__')
                after = null;
              if (group.keys.has(key) && group.keys.get(key) !== after)
                throw invalid('اطلاعات تکرارشدهٔ یک محصول در ردیف‌ها ناسازگار است', line);
              group.keys.set(key, after);
              const before = product[key];
              if (before !== after) {
                Object.assign(group.patch, { [key]: after });
                changes.push({ field: key, before, after });
              }
            }
            if (Object.keys(group.patch).length && !preview && !row.expectedUpdatedAt)
              throw invalid('ابتدا پیش‌نمایش اطلاعات محصول را دریافت کنید', line);
            if (variant) {
              if (claimedVariants.has(variant.id))
                throw invalid('یک گزینهٔ محصول بیش از یک بار هدف ویرایش است', line);
              claimedVariants.add(variant.id);
              data.variantId = variant.id;
              const patch: Prisma.ProductVariantUpdateInput = {};
              for (const key of variantKeys)
                if (row[key] !== undefined && row[key] !== variant[key]) {
                  Object.assign(patch, { [key]: row[key] });
                  changes.push({ field: key, before: variant[key], after: row[key] });
                }
              group.variants.set(variant.id, patch);
              reviews.push({
                line,
                action: changes.length ? 'update' : 'unchanged',
                data,
                changes,
              });
            } else if (row.sku) {
              if (newSkus.has(row.sku)) throw invalid('شناسهٔ کالای جدید در فایل تکراری است', line);
              newSkus.add(row.sku);
              if (row.price === undefined || !row.weightGram)
                throw invalid('گزینهٔ جدید به قیمت و وزن بیشتر از صفر نیاز دارد', line);
              group.additions.push(data);
              reviews.push({
                line,
                action: 'add-variant',
                data,
                changes: [
                  ...changes,
                  ...variantKeys
                    .filter((k) => row[k] !== undefined)
                    .map((field) => ({ field, before: null, after: row[field] })),
                ],
              });
            } else {
              if (variantKeys.some((k) => row[k] !== undefined))
                throw invalid('برای ویرایش موجودی یا قیمت، شناسهٔ گزینه یا SKU لازم است', line);
              reviews.push({
                line,
                action: changes.length ? 'update' : 'unchanged',
                data,
                changes,
              });
            }
          }
          for (const group of groups.values()) {
            const effective = { ...group.product, ...group.patch } as Product;
            for (const [key, list] of [
              ['brandId', brands],
              ['categoryId', categories],
              ['petTypeId', petTypes],
            ] as const)
              if (!list.some((r) => r.id === effective[key]))
                throw invalid('مرجع محصول موجود یافت نشد');
            if (effective.isActive) {
              await this.products.assertPublishableReferences(tx, effective);
              if (
                group.product.variants.some(
                  (v) =>
                    v.isActive && Number(group.variants.get(v.id)?.weightGram ?? v.weightGram) <= 0,
                )
              )
                throw invalid('پیش از انتشار، وزن گزینه‌های فعال را کامل کنید');
            }
          }
          const totals = {
            created: reviews.filter((r) => r.action === 'create').length,
            updated: reviews.filter((r) => r.action === 'update').length,
            unchanged: reviews.filter((r) => r.action === 'unchanged').length,
            variantsAdded: reviews.filter((r) => r.action === 'add-variant').length,
          };
          if (preview) return { rows: reviews, totals };
          // Existing services' create validation and all new reference writes join this transaction.
          const importer = new ProductsImportService({
            $transaction: <T>(fn: (inner: Prisma.TransactionClient) => Promise<T>) => fn(tx),
          } as unknown as PrismaService);
          for (let offset = 0; offset < creates.length; offset += 100) {
            const batch = creates
              .slice(offset, offset + 100)
              .map(({ productId, variantId, expectedStock, expectedUpdatedAt, ...row }) => ({
                ...row,
                name: row.name!,
                price: row.price!,
                ingredientsText:
                  row.ingredientsText === '__CLEAR__' ? undefined : row.ingredientsText,
                description: row.description === '__CLEAR__' ? undefined : row.description,
              }));
            await importer.importBatch({ rows: batch });
          }
          for (const group of groups.values()) {
            let changed = Object.keys(group.patch).length > 0;
            for (const [id, patch] of group.variants)
              if (Object.keys(patch).length) {
                await tx.productVariant.update({ where: { id }, data: patch });
                changed = true;
              }
            for (const row of group.additions) {
              await tx.productVariant.create({
                data: {
                  productId: group.product.id,
                  sku: row.sku!,
                  price: row.price!,
                  weightGram: row.weightGram!,
                  stock: row.stock ?? 0,
                  compareAtPrice: row.compareAtPrice ?? null,
                  isActive: true,
                },
              });
              changed = true;
            }
            if (changed) {
              const cheapest = await tx.productVariant.findFirst({
                where: { productId: group.product.id, isActive: true },
                orderBy: { price: 'asc' },
                select: { price: true },
              });
              await tx.product.update({
                where: { id: group.product.id },
                data: { ...group.patch, minPrice: cheapest?.price ?? 0 },
              });
            }
          }
          return totals;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 60000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2003', 'P2034'].includes(error.code)
      )
        throw new AppException(
          'CONFLICT',
          'اطلاعات هم‌زمان تغییر کرده یا شناسه تکراری است؛ هیچ ردیفی ثبت نشد',
          409,
        );
      throw error;
    }
  }
}
