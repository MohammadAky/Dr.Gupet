import { Prisma } from '@prisma/client';
import { ProductsImportService } from './products-import.service';
import { ImportProductsDto, SQL_INT_MAX } from './dto/import-products.dto';
import { CreateVariantDto } from './dto/admin-product.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

function batch(rows: unknown[] = [{ name: 'غذای سگ', price: 123456 }]): ImportProductsDto {
  return { brandId: 1, categoryId: 2, petTypeId: 3, rows } as ImportProductsDto;
}

function harness() {
  const stored: unknown[] = [];
  const references = {
    brands: [{ id: 1, name: 'برند موجود', slug: 'existing-brand', isActive: true }],
    categories: [
      {
        id: 2,
        name: 'دسته موجود',
        slug: 'existing-category',
        petTypeId: 3 as number | null,
        isActive: true,
      },
    ],
    petTypes: [
      { id: 3, name: 'سگ', slug: 'dog', isActive: true },
      { id: 4, name: 'گربه', slug: 'cat', isActive: true },
    ],
  };
  const tx = {
    brand: {
      findMany: jest.fn(async () => references.brands.map((row) => ({ ...row }))),
      create: jest.fn(async ({ data }) => {
        const row = { id: references.brands.length + 10, ...data };
        references.brands.push(row);
        return { ...row };
      }),
    },
    productCategory: {
      findMany: jest.fn(async () => references.categories.map((row) => ({ ...row }))),
      create: jest.fn(async ({ data }) => {
        const row = { id: references.categories.length + 20, ...data };
        references.categories.push(row);
        return { ...row };
      }),
    },
    petType: { findMany: jest.fn(async () => references.petTypes.map((row) => ({ ...row }))) },
    product: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(async ({ data }) => {
        stored.push(data);
        return { id: stored.length, name: data.name, slug: data.slug };
      }),
    },
    productVariant: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = {
    $transaction: jest.fn(async (fn) => {
      const before = stored.length;
      const brandCount = references.brands.length;
      const categoryCount = references.categories.length;
      try {
        return await fn(tx);
      } catch (error) {
        stored.splice(before);
        references.brands.splice(brandCount);
        references.categories.splice(categoryCount);
        throw error;
      }
    }),
  };
  return {
    tx,
    prisma,
    stored,
    references,
    service: new ProductsImportService(prisma as unknown as PrismaService),
  };
}

describe('Atomic product import service (isolated transaction harness)', () => {
  it('imports name/price only with zero numeric defaults and inactive unpublished records', async () => {
    const h = harness();
    expect(await h.service.importBatch(batch())).toEqual({
      imported: 1,
      products: [{ id: 1, name: 'غذای سگ', slug: 'غذای-سگ' }],
    });
    expect(h.stored[0]).toMatchObject({
      brandId: 1,
      categoryId: 2,
      petTypeId: 3,
      minPrice: 123456,
      isActive: false,
      variants: {
        create: {
          sku: expect.stringMatching(/^IMPORT-/),
          weightGram: 0,
          stock: 0,
          compareAtPrice: 0,
          price: 123456,
          isActive: true,
        },
      },
    });
  });

  it('retains explicit zero price, maximum SQL price, weight and raw Toman without scaling', async () => {
    const h = harness();
    await h.service.importBatch(
      batch([
        { name: '  خوراک الف ', price: 0 },
        { name: 'خوراک ب', price: SQL_INT_MAX, weightGram: 100, isActive: true },
      ]),
    );
    expect(h.stored[0]).toMatchObject({ name: 'خوراک الف', variants: { create: { price: 0 } } });
    expect(h.stored[1]).toMatchObject({
      minPrice: SQL_INT_MAX,
      variants: { create: { price: SQL_INT_MAX, isActive: true } },
    });
  });

  it('preserves ingredients and description in their own columns and unique generated SKUs', async () => {
    const h = harness();
    await h.service.importBatch(
      batch([
        { name: 'كالا الف', price: 10, ingredientsText: ' ترکیب ', description: ' بلند ' },
        { name: 'کالا ب', price: 20 },
      ]),
    );
    expect(h.stored[0]).toMatchObject({
      name: 'کالا الف',
      ingredientsText: 'ترکیب',
      description: 'بلند',
    });
    const data = h.stored as Array<{ variants: { create: { sku: string } } }>;
    expect(data[0].variants.create.sku).not.toBe(data[1].variants.create.sku);
  });

  it.each(['price', 'stock', 'weightGram', 'compareAtPrice'])(
    'rejects invalid %s before any transaction',
    async (field) => {
      for (const value of [-1, 1.5, NaN, Infinity, SQL_INT_MAX + 1, '12', null]) {
        const h = harness();
        await expect(
          h.service.importBatch(batch([{ name: 'کالا', price: 1, [field]: value }])),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
        expect(h.prisma.$transaction).not.toHaveBeenCalled();
      }
    },
  );

  it.each([
    { name: '   ', price: 10 },
    { name: 'ـ‌', price: 10 },
    { name: 'کالا' },
    { name: 'کالا', price: 10, isActive: true },
    { name: 'کالا', price: 10, isActive: 'false' },
    { name: 'کالا', price: 10, extra: 'untrusted' },
  ])('rejects an invalid row %# before writes', async (row) => {
    const h = harness();
    await expect(h.service.importBatch(batch([row]))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(h.tx.product.create).not.toHaveBeenCalled();
  });

  it.each([
    { rows: [] },
    { rows: Array.from({ length: 101 }, (_, i) => ({ name: `کالا ${i}`, price: 1 })) },
  ])('rejects batches outside 1–100 rows', async ({ rows }) => {
    const h = harness();
    await expect(h.service.importBatch(batch(rows))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    {
      rows: [
        { name: 'كالا', price: 1 },
        { name: 'کالا', price: 2 },
      ],
    },
    {
      rows: [
        { name: 'کالا الف', price: 1, sku: 'SAME' },
        { name: 'کالا ب', price: 2, sku: 'SAME' },
      ],
    },
  ])('rejects normalized within-batch duplicates', async ({ rows }) => {
    const h = harness();
    await expect(h.service.importBatch(batch(rows))).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['brand', 'productCategory', 'petType'] as const)(
    'rejects a missing %s without creating products',
    async (model) => {
      const h = harness();
      h.tx[model].findMany.mockResolvedValue([]);
      await expect(h.service.importBatch(batch())).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(h.tx.product.create).not.toHaveBeenCalled();
    },
  );

  it('rejects category/species mismatch and zero references', async () => {
    const h = harness();
    h.references.categories[0].petTypeId = 4;
    await expect(h.service.importBatch(batch())).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(h.service.importBatch({ ...batch(), brandId: 0 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(h.tx.product.create).not.toHaveBeenCalled();
  });

  it.each(['product', 'productVariant'] as const)(
    'rejects existing unique values in %s before writes',
    async (model) => {
      const h = harness();
      h.tx[model].findMany.mockResolvedValue([{}]);
      await expect(h.service.importBatch(batch())).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(h.tx.product.create).not.toHaveBeenCalled();
    },
  );

  it.each(['P2002', 'P2003'])(
    'surfaces racing %s constraints as conflicts and rolls back the harness',
    async (code) => {
      const h = harness();
      h.tx.product.create
        .mockImplementationOnce(async ({ data }) => {
          h.stored.push(data);
          return { id: 1, name: data.name, slug: data.slug };
        })
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('race', { code, clientVersion: '5' }),
        );
      await expect(
        h.service.importBatch(
          batch([
            { name: 'کالا الف', price: 1 },
            { name: 'کالا ب', price: 2 },
          ]),
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(h.stored).toEqual([]);
      expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps ordinary variant weight validation at minimum one', () => {
    const dto = plainToInstance(CreateVariantDto, { sku: 'NORMAL', weightGram: 0, price: 10 });
    expect(validateSync(dto).some((error) => error.property === 'weightGram')).toBe(true);
  });

  it('imports mixed numeric references per row and uses top-level fields only as fallbacks', async () => {
    const h = harness();
    h.references.brands.push({ id: 5, name: 'برند دوم', slug: 'second-brand', isActive: true });
    h.references.categories.push({
      id: 6,
      name: 'دسته گربه',
      slug: 'cat-category',
      petTypeId: 4,
      isActive: true,
    });
    await h.service.importBatch(
      batch([
        { name: 'خوراک سگ', price: 10 },
        { name: 'خوراک گربه', price: 20, brandId: 5, categoryId: 6, petTypeId: 4 },
      ]),
    );
    expect(h.stored[0]).toMatchObject({ brandId: 1, categoryId: 2, petTypeId: 3 });
    expect(h.stored[1]).toMatchObject({ brandId: 5, categoryId: 6, petTypeId: 4 });
    expect(h.tx.brand.create).not.toHaveBeenCalled();
    expect(h.tx.productCategory.create).not.toHaveBeenCalled();
  });

  it('accepts an entirely row-defined batch without top-level defaults', async () => {
    const h = harness();
    await h.service.importBatch({
      rows: [{ name: 'خوراک', price: 10, brandId: 1, categoryId: 2, petTypeId: 3 }],
    });
    expect(h.stored[0]).toMatchObject({ brandId: 1, categoryId: 2, petTypeId: 3 });
  });

  it('resolves exact normalized Persian names without creating duplicate references', async () => {
    const h = harness();
    h.references.brands[0].name = 'برند كيان';
    h.references.categories[0].name = 'خوراك‌سگ';
    await h.service.importBatch({
      petTypeId: 3,
      rows: [{ name: 'خوراک', price: 1, brandName: ' برند کیان ', categoryName: 'خوراکسگ' }],
    });
    expect(h.stored[0]).toMatchObject({ brandId: 1, categoryId: 2, petTypeId: 3 });
    expect(h.tx.brand.create).not.toHaveBeenCalled();
    expect(h.tx.productCategory.create).not.toHaveBeenCalled();
  });

  it('creates missing references once, overrides fallbacks with names and isolates categories by species', async () => {
    const h = harness();
    await h.service.importBatch(
      batch([
        { name: 'خوراک سگ الف', price: 10, brandName: 'برند تازه', categoryName: 'خوراک خشک' },
        {
          name: 'خوراک گربه',
          price: 20,
          petTypeId: 4,
          brandName: 'برند تازه',
          categoryName: 'خوراک خشک',
        },
        { name: 'خوراک سگ ب', price: 30, brandName: 'برند تازه', categoryName: 'خوراک خشک' },
      ]),
    );
    expect(h.tx.brand.create).toHaveBeenCalledTimes(1);
    expect(h.tx.brand.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'برند تازه', slug: 'برند-تازه', isActive: true } }),
    );
    expect(h.tx.productCategory.create).toHaveBeenCalledTimes(2);
    expect(h.references.categories.slice(1)).toEqual([
      { id: 21, name: 'خوراک خشک', slug: 'خوراک-خشک-pet-3', petTypeId: 3, isActive: true },
      { id: 22, name: 'خوراک خشک', slug: 'خوراک-خشک-pet-4', petTypeId: 4, isActive: true },
    ]);
    expect(h.stored[0]).toMatchObject({ brandId: 11, categoryId: 21, petTypeId: 3 });
    expect(h.stored[1]).toMatchObject({ brandId: 11, categoryId: 22, petTypeId: 4 });
    expect(h.stored[2]).toMatchObject({ brandId: 11, categoryId: 21, petTypeId: 3 });
  });

  it('reuses a single compatible global category across different species', async () => {
    const h = harness();
    h.references.categories[0].petTypeId = null;
    await h.service.importBatch({
      brandId: 1,
      rows: [
        { name: 'محصول سگ', price: 1, petTypeId: 3, categoryName: 'دسته موجود' },
        { name: 'محصول گربه', price: 1, petTypeId: 4, categoryName: 'دسته موجود' },
      ],
    });
    expect(h.stored[0]).toMatchObject({ categoryId: 2, petTypeId: 3 });
    expect(h.stored[1]).toMatchObject({ categoryId: 2, petTypeId: 4 });
    expect(h.tx.productCategory.create).not.toHaveBeenCalled();
  });

  it.each(['brand', 'category', 'petType'] as const)(
    'requires a resolved %s for every row',
    async (reference) => {
      const h = harness();
      const row = { name: 'خوراک', price: 1, brandId: 1, categoryId: 2, petTypeId: 3 };
      delete (row as Record<string, unknown>)[`${reference}Id`];
      await expect(h.service.importBatch({ rows: [row] })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(h.prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['brand', 'category'] as const)(
    'rejects simultaneous row %s ID and name',
    async (reference) => {
      const h = harness();
      await expect(
        h.service.importBatch(
          batch([{ name: 'خوراک', price: 1, [`${reference}Id`]: 1, [`${reference}Name`]: 'نام' }]),
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(h.prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['brandId', 'categoryId', 'petTypeId'] as const)(
    'rejects malformed row %s rather than using its fallback',
    async (field) => {
      for (const value of [0, -1, 1.5, '1', null, SQL_INT_MAX + 1]) {
        const h = harness();
        await expect(
          h.service.importBatch(batch([{ name: 'خوراک', price: 1, [field]: value }])),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
        expect(h.prisma.$transaction).not.toHaveBeenCalled();
      }
    },
  );

  it.each(['brandName', 'categoryName'] as const)(
    'rejects malformed or blank %s',
    async (field) => {
      for (const value of ['', ' \t ', 'ـ‌', null, 1, 'م'.repeat(192)]) {
        const h = harness();
        await expect(
          h.service.importBatch(batch([{ name: 'خوراک', price: 1, [field]: value }])),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
        expect(h.prisma.$transaction).not.toHaveBeenCalled();
      }
    },
  );

  it.each(['brands', 'categories', 'petTypes'] as const)(
    'rejects inactive existing %s selected by ID',
    async (reference) => {
      const h = harness();
      h.references[reference][0].isActive = false;
      await expect(h.service.importBatch(batch())).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(h.stored).toEqual([]);
    },
  );

  it.each(['brands', 'categories'] as const)(
    'rejects an inactive name in %s without recreating it',
    async (reference) => {
      const h = harness();
      h.references[reference][0].isActive = false;
      const row =
        reference === 'brands' ? { brandName: 'برند موجود' } : { categoryName: 'دسته موجود' };
      await expect(
        h.service.importBatch(batch([{ name: 'خوراک', price: 1, ...row }])),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(h.tx.brand.create).not.toHaveBeenCalled();
      expect(h.tx.productCategory.create).not.toHaveBeenCalled();
    },
  );

  it('rejects duplicate normalized brand names instead of choosing one arbitrarily', async () => {
    const h = harness();
    h.references.brands.push({
      id: 9,
      name: 'برند‌ موجود',
      slug: 'duplicate-brand',
      isActive: true,
    });
    await expect(
      h.service.importBatch(batch([{ name: 'خوراک', price: 1, brandName: 'برند موجود' }])),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(h.stored).toEqual([]);
  });

  it('rejects ambiguous scoped and global category names; explicit ID remains available', async () => {
    const h = harness();
    h.references.categories.push({
      id: 9,
      name: 'دسته موجود',
      slug: 'global-category',
      petTypeId: null,
      isActive: true,
    });
    await expect(
      h.service.importBatch(batch([{ name: 'خوراک', price: 1, categoryName: 'دسته موجود' }])),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(h.stored).toEqual([]);
    await h.service.importBatch(batch());
    expect(h.stored[0]).toMatchObject({ categoryId: 2 });
  });

  it('never reuses a category belonging to another species, including an ID fallback', async () => {
    const h = harness();
    await expect(
      h.service.importBatch(batch([{ name: 'خوراک گربه', price: 1, petTypeId: 4 }])),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await h.service.importBatch(
      batch([{ name: 'خوراک گربه', price: 1, petTypeId: 4, categoryName: 'دسته موجود' }]),
    );
    expect(h.stored[0]).toMatchObject({ petTypeId: 4, categoryId: 21 });
    expect(h.references.categories[1]).toMatchObject({ name: 'دسته موجود', petTypeId: 4 });
  });

  it.each(['brandName', 'categoryName'] as const)(
    'rejects %s that cannot generate a usable slug',
    async (field) => {
      const h = harness();
      await expect(
        h.service.importBatch(batch([{ name: 'خوراک', price: 1, [field]: '!!!' }])),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(h.stored).toEqual([]);
    },
  );

  it('keeps a maximum-length new category slug within the SQL limit with a stable species suffix', async () => {
    const h = harness();
    await h.service.importBatch(
      batch([{ name: 'خوراک', price: 1, categoryName: 'م'.repeat(191) }]),
    );
    expect(h.references.categories[1].slug).toHaveLength(191);
    expect(h.references.categories[1].slug.endsWith('-pet-3')).toBe(true);
  });

  it.each(['brand', 'category'] as const)(
    'rejects generated %s slug collision rather than reusing unrelated identity',
    async (reference) => {
      const h = harness();
      if (reference === 'brand') h.references.brands[0].slug = 'برند-تازه';
      else h.references.categories[0].slug = 'دسته-تازه-pet-3';
      const row =
        reference === 'brand' ? { brandName: 'برند تازه' } : { categoryName: 'دسته تازه' };
      await expect(
        h.service.importBatch(batch([{ name: 'خوراک', price: 1, ...row }])),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(h.stored).toEqual([]);
      expect(h.references.brands).toHaveLength(1);
      expect(h.references.categories).toHaveLength(1);
    },
  );

  it('rolls back previously created references and products when a later row has invalid species', async () => {
    const h = harness();
    await expect(
      h.service.importBatch({
        rows: [
          {
            name: 'محصول اول',
            price: 1,
            petTypeId: 3,
            brandName: 'برند تازه',
            categoryName: 'دسته تازه',
          },
          {
            name: 'محصول دوم',
            price: 1,
            petTypeId: 999,
            brandName: 'برند تازه',
            categoryName: 'دسته تازه',
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(h.tx.brand.create).toHaveBeenCalledTimes(1);
    expect(h.tx.productCategory.create).toHaveBeenCalledTimes(1);
    expect(h.tx.product.create).toHaveBeenCalledTimes(1);
    expect(h.stored).toEqual([]);
    expect(h.references.brands).toHaveLength(1);
    expect(h.references.categories).toHaveLength(1);
  });

  it('rolls back the entire mixed batch when later reference names collide on their slug', async () => {
    const h = harness();
    await expect(
      h.service.importBatch({
        rows: [
          {
            name: 'محصول اول',
            price: 1,
            petTypeId: 3,
            brandName: 'برند تازه',
            categoryName: 'دسته تازه',
          },
          {
            name: 'محصول دوم',
            price: 1,
            petTypeId: 4,
            brandName: 'برند تازه!',
            categoryName: 'دسته تازه',
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(h.tx.product.create).toHaveBeenCalledTimes(1);
    expect(h.stored).toEqual([]);
    expect(h.references.brands).toHaveLength(1);
    expect(h.references.categories).toHaveLength(1);
  });

  it.each(['P2002', 'P2003'] as const)(
    'rolls back newly created references on a racing %s product constraint',
    async (code) => {
      const h = harness();
      h.tx.product.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('isolated constraint failure', {
          code,
          clientVersion: '5',
        }),
      );
      await expect(
        h.service.importBatch({
          rows: [
            {
              name: 'محصول',
              price: 1,
              petTypeId: 3,
              brandName: 'برند تازه',
              categoryName: 'دسته تازه',
            },
          ],
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(h.tx.brand.create).toHaveBeenCalledTimes(1);
      expect(h.tx.productCategory.create).toHaveBeenCalledTimes(1);
      expect(h.references.brands).toHaveLength(1);
      expect(h.references.categories).toHaveLength(1);
      expect(h.stored).toEqual([]);
    },
  );
});
