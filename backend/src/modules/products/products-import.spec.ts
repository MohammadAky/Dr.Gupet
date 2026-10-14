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
  const tx = {
    brand: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
    productCategory: { findUnique: jest.fn().mockResolvedValue({ id: 2, petTypeId: 3 }) },
    petType: { findUnique: jest.fn().mockResolvedValue({ id: 3 }) },
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
      try {
        return await fn(tx);
      } catch (error) {
        stored.splice(before);
        throw error;
      }
    }),
  };
  return {
    tx,
    prisma,
    stored,
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
      h.tx[model].findUnique.mockResolvedValue(null);
      await expect(h.service.importBatch(batch())).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(h.tx.product.create).not.toHaveBeenCalled();
    },
  );

  it('rejects category/species mismatch and zero references', async () => {
    const h = harness();
    h.tx.productCategory.findUnique.mockResolvedValue({ id: 2, petTypeId: 4 });
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
});
