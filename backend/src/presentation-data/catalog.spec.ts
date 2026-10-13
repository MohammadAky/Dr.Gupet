import { assertPresentationTarget, importPresentationData } from './catalog';
import { CartService } from '../modules/cart/cart.service';
import { OrderStockService } from '../modules/orders/order-stock.service';
import { ProductsService } from '../modules/products/products.service';
import { MedicinesService } from '../modules/medicines/medicines.service';
import { PharmaciesService } from '../modules/pharmacies/pharmacies.service';

describe('Explicit persistent presentation records', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('requires named loopback local DB, or explicit backed-up production operation', () => {
    process.env.NODE_ENV = 'test';
    expect(
      assertPresentationTarget('mysql://a:b@127.0.0.1:3399/review', 'review', false, false),
    ).toEqual({ database: 'review', production: false });
    expect(() =>
      assertPresentationTarget('mysql://a:b@remote/review', 'review', false, false),
    ).toThrow();
    expect(() =>
      assertPresentationTarget('mysql://a:b@127.0.0.1/live', 'review', false, false),
    ).toThrow();
    process.env.NODE_ENV = 'production';
    expect(() => assertPresentationTarget('mysql://a:b@mysql/live', 'live', true, false)).toThrow();
    expect(assertPresentationTarget('mysql://a:b@mysql/live', 'live', true, true)).toEqual({
      database: 'live',
      production: true,
    });
  });

  it('creates once and preserves all existing rows on a second run; no clinic or claimed coordinates', async () => {
    let nextId = 1;
    function model(uniqueKey: string) {
      const rows: any[] = [];
      return {
        rows,
        findUnique: jest.fn(
          async ({ where }: any) => rows.find((row) => row[uniqueKey] === where[uniqueKey]) ?? null,
        ),
        findMany: jest.fn(async (args?: any) =>
          args?.where?.name ? rows.filter((row) => row.name === args.where.name) : rows,
        ),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: nextId++, isActive: true, ...data };
          rows.push(row);
          return row;
        }),
      };
    }
    const tx: any = {
      petType: model('slug'),
      brand: model('slug'),
      productCategory: model('slug'),
      product: model('slug'),
      medicine: model('name'),
      pharmacy: model('name'),
    };
    const first = await importPresentationData(tx);
    expect(first).toEqual({ products: 6, medicines: 6, pharmacies: 6, species: 3 });
    expect(await importPresentationData(tx)).toEqual({
      products: 0,
      medicines: 0,
      pharmacies: 0,
      species: 0,
    });
    for (const row of tx.product.rows) expect(row.variants.create.stock).toBe(0);
    for (const row of tx.pharmacy.rows) {
      expect(row.lat).toBeUndefined();
      expect(row.lng).toBeUndefined();
      expect(row.phone).toBeUndefined();
      expect(row.isVerified).toBe(false);
    }
    expect(tx.clinic).toBeUndefined();
  });

  it('sample filters remain effective when q also supplied', async () => {
    for (const [Model, key] of [
      [MedicinesService, 'medicine'],
      [PharmaciesService, 'pharmacy'],
    ] as const) {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new Model({
        [key]: { findMany, count: jest.fn().mockResolvedValue(0) },
      } as any);
      await service.findAll({ q: 'مهر', sampleOnly: true } as any);
      expect(findMany.mock.calls[0][0].where.AND).toEqual([
        { name: { endsWith: '— نمونه نمایشی' } },
      ]);
      expect(
        findMany.mock.calls[0][0].where.name ?? findMany.mock.calls[0][0].where.OR[0].name,
      ).toEqual({ contains: 'مهر' });
    }
  });

  it('cannot buy sample variants even when an administrator adds stock', async () => {
    const prisma: any = {
      productVariant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          stock: 20,
          isActive: true,
          product: { isActive: true, slug: 'presentation-v1-cat-food' },
        }),
      },
      cart: { create: jest.fn() },
    };
    await expect(
      new CartService(prisma, {} as any, {} as any).addItem(1, 1, 1),
    ).rejects.toMatchObject({ code: 'PRESENTATION_ONLY' });
    expect(prisma.cart.create).not.toHaveBeenCalled();
    const tx: any = { productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    await expect(
      new OrderStockService().reserve(tx, [{ variantId: 1, quantity: 1 }]),
    ).rejects.toThrow();
    expect(tx.productVariant.updateMany.mock.calls[0][0].where.product).toEqual({
      slug: { not: { startsWith: 'presentation-v1-' } },
    });
  });

  it('public cards and details disclose samples and keep purchase availability false', async () => {
    const product = {
      id: 1,
      slug: 'presentation-v1-cat-food',
      name: 'غذای نمونه',
      variants: [{ stock: 20, price: 100 }],
      images: [],
      tags: [],
    };
    const prisma: any = {
      product: {
        findMany: jest.fn().mockResolvedValue([product]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(product),
      },
    };
    const service = new ProductsService(prisma);
    expect((await service.findAll({ sampleOnly: true } as any)).data[0]).toMatchObject({
      isSample: true,
      inStock: false,
    });
    const detail = await service.findBySlug(product.slug);
    expect(detail.isSample).toBe(true);
    expect(detail.variants[0].inStock).toBe(false);
  });
});
