import { ProductsSyncService } from './products-sync.service';
import { AdminProductsService } from './admin-products.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ProductVariantsService } from './product-variants.service';
import { csvCell, exportColumns, productExportCsv } from './product-export';

function harness() {
  let state = {
    products: [
      {
        id: 1,
        name: 'غذای سگ',
        slug: 'dog-food',
        brandId: 1,
        categoryId: 2,
        petTypeId: 3,
        isActive: true,
        description: 'توضیح قبلی',
        ingredientsText: null,
        minPrice: 100,
        updatedAt: new Date('2026-10-17T00:00:00Z'),
      },
    ],
    variants: [
      {
        id: 11,
        productId: 1,
        sku: 'SKU-1',
        price: 100,
        stock: 10,
        weightGram: 500,
        compareAtPrice: null,
        isActive: true,
      },
      {
        id: 12,
        productId: 1,
        sku: 'SKU-2',
        price: 200,
        stock: 5,
        weightGram: 1000,
        compareAtPrice: null,
        isActive: true,
      },
    ],
    brands: [{ id: 1, name: 'برند', slug: 'brand', isActive: true }],
    categories: [
      { id: 2, name: 'غذا', slug: 'food', petTypeId: 3 as number | null, isActive: true },
    ],
    petTypes: [{ id: 3, name: 'سگ', slug: 'dog', isActive: true }],
  };
  let failVariant: number | undefined;
  const locks = jest.fn();
  const writes = jest.fn();
  function client(db: typeof state) {
    const product = (p: (typeof db.products)[number]) => ({
      ...p,
      variants: db.variants.filter((v) => v.productId === p.id),
    });
    const tx = {
      $queryRaw: locks,
      product: {
        findUnique: jest.fn(async ({ where }) => {
          const p = db.products.find((p) => (where.id ? p.id === where.id : p.slug === where.slug));
          return p ? product(p) : null;
        }),
        findMany: jest.fn(async ({ where = {} } = {}) =>
          db.products
            .filter(
              (p) =>
                (!where.id?.in || where.id.in.includes(p.id)) &&
                (!where.slug?.in || where.slug.in.includes(p.slug)),
            )
            .map(product),
        ),
        update: jest.fn(async ({ where, data }) => {
          writes();
          const p = db.products.find((p) => p.id === where.id)!;
          Object.assign(p, data, { updatedAt: new Date(p.updatedAt.getTime() + 1000) });
          return product(p);
        }),
        create: jest.fn(async ({ data }) => {
          writes();
          const id = Math.max(0, ...db.products.map((p) => p.id)) + 1;
          const { variants, ...fields } = data;
          const p = {
            id,
            updatedAt: new Date(),
            description: null,
            ingredientsText: null,
            ...fields,
          };
          db.products.push(p);
          if (variants?.create)
            db.variants.push({
              id: Math.max(...db.variants.map((v) => v.id)) + 1,
              productId: id,
              ...variants.create,
            });
          return p;
        }),
      },
      productVariant: {
        findUnique: jest.fn(
          async ({ where }) =>
            db.variants.find((v) => (where.id ? v.id === where.id : v.sku === where.sku)) ?? null,
        ),
        findMany: jest.fn(async ({ where = {} } = {}) =>
          db.variants.filter((v) => !where.sku?.in || where.sku.in.includes(v.sku)),
        ),
        findFirst: jest.fn(
          async ({ where }) =>
            db.variants
              .filter((v) => v.productId === where.productId && v.isActive)
              .sort((a, b) => a.price - b.price)[0] ?? null,
        ),
        update: jest.fn(async ({ where, data }) => {
          if (failVariant === where.id) throw new Error('isolated DB failure');
          writes();
          const v = db.variants.find((v) => v.id === where.id)!;
          Object.assign(v, data);
          return v;
        }),
        create: jest.fn(async ({ data }) => {
          writes();
          const v = { id: Math.max(...db.variants.map((v) => v.id)) + 1, ...data };
          db.variants.push(v);
          return v;
        }),
      },
      brand: {
        findMany: jest.fn(async () => db.brands),
        findUnique: jest.fn(async ({ where }) => db.brands.find((b) => b.id === where.id)),
        create: jest.fn(),
      },
      productCategory: {
        findMany: jest.fn(async () => db.categories),
        findUnique: jest.fn(async ({ where }) => db.categories.find((c) => c.id === where.id)),
        create: jest.fn(),
      },
      petType: {
        findMany: jest.fn(async () => db.petTypes),
        findUnique: jest.fn(async ({ where }) => db.petTypes.find((p) => p.id === where.id)),
      },
    };
    return tx;
  }
  const prisma = {
    ...client(state),
    $transaction: jest.fn(async (fn) => {
      const draft = structuredClone(state);
      const value = await fn(client(draft));
      state = draft;
      return value;
    }),
  };
  const products = new AdminProductsService(
    prisma as unknown as PrismaService,
    {} as ProductVariantsService,
  );
  const service = new ProductsSyncService(prisma as unknown as PrismaService, products);
  return {
    service,
    prisma,
    locks,
    writes,
    get state() {
      return state;
    },
    failOnVariant(id: number) {
      failVariant = id;
    },
  };
}

describe('Reviewed CSV synchronization', () => {
  it('previews SKU matches with snapshots and writes nothing', async () => {
    const h = harness();
    const result = await h.service.synchronize({ rows: [{ sku: 'SKU-1', stock: 0 }] }, true);
    expect(result).toMatchObject({
      totals: { updated: 1, created: 0 },
      rows: [
        {
          line: 2,
          action: 'update',
          data: {
            productId: 1,
            variantId: 11,
            expectedStock: 10,
            expectedUpdatedAt: '2026-10-17T00:00:00.000Z',
          },
          changes: [{ field: 'stock', before: 10, after: 0 }],
        },
      ],
    });
    expect(h.writes).not.toHaveBeenCalled();
    expect(h.state.variants[0].stock).toBe(10);
  });
  it('applies explicit zero without replacing IDs, other variants, text or price', async () => {
    const h = harness();
    const preview = await h.service.synchronize({ rows: [{ sku: 'SKU-1', stock: 0 }] }, true);
    if (!('rows' in preview)) throw Error('Preview expected');
    expect(
      await h.service.synchronize({ rows: preview.rows.map((r) => r.data) }, false),
    ).toMatchObject({ updated: 1 });
    expect(h.state.variants[0]).toMatchObject({ id: 11, productId: 1, stock: 0, price: 100 });
    expect(h.state.variants[1]).toMatchObject({ id: 12, stock: 5 });
    expect(h.state.products[0]).toMatchObject({ id: 1, description: 'توضیح قبلی' });
    expect(h.locks).toHaveBeenCalled();
  });
  it('never restores a sold unit when the exported stock cell was not edited', async () => {
    const h = harness();
    h.state.variants[0].stock = 9;
    const preview = await h.service.synchronize(
      { rows: [{ sku: 'SKU-1', price: 90, stock: 10, expectedStock: 10 }] },
      true,
    );
    if (!('rows' in preview)) throw Error('preview');
    // The untouched stock column is dropped with a note instead of failing the file.
    expect(preview.notes).toEqual([
      expect.objectContaining({ line: 2, variant: 'SKU-1', field: 'stock' }),
    ]);
    expect(preview.rows[0]?.changes).toEqual([{ field: 'price', before: 100, after: 90 }]);
    await h.service.synchronize({ rows: preview.rows.map((r) => r.data) }, false);
    expect(h.state.variants[0]).toMatchObject({ stock: 9, price: 90 });
    expect(h.state.variants[1]).toMatchObject({ stock: 5, price: 200 });
  });
  it('rejects an edited stock cell whose exported snapshot is stale', async () => {
    const h = harness();
    h.state.variants[0].stock = 9;
    await expect(
      h.service.synchronize({ rows: [{ sku: 'SKU-1', stock: 12, expectedStock: 10 }] }, true),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      details: [expect.objectContaining({ line: 2, field: 'stock', variant: 'SKU-1' })],
    });
    expect(h.writes).not.toHaveBeenCalled();
    expect(h.state.variants[0].stock).toBe(9);
  });
  it('reports the row and product of a stale metadata edit instead of a generic conflict', async () => {
    const h = harness();
    await expect(
      h.service.synchronize(
        { rows: [{ sku: 'SKU-1', name: 'نام تازه', expectedUpdatedAt: '2026-10-16T00:00:00Z' }] },
        true,
      ),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: expect.stringContaining('غذای سگ'),
      details: [expect.objectContaining({ line: 2, field: 'name', product: 'غذای سگ' })],
    });
    expect(h.writes).not.toHaveBeenCalled();
  });
  it('applies price-only edits even when product metadata moved after the export', async () => {
    const h = harness();
    h.state.products[0].updatedAt = new Date('2026-10-18T00:00:00Z');
    const preview = await h.service.synchronize(
      {
        rows: [
          {
            sku: 'SKU-1',
            price: 120,
            expectedUpdatedAt: '2026-10-17T00:00:00.000Z',
          },
        ],
      },
      true,
    );
    if (!('rows' in preview)) throw Error('preview');
    expect(preview.rows[0]?.action).toBe('update');
    expect(preview.notes).toEqual([]);
    await h.service.synchronize({ rows: preview.rows.map((r) => r.data) }, false);
    expect(h.state.variants[0]).toMatchObject({ id: 11, price: 120, stock: 10 });
    // The concurrent metadata edit is preserved; only the price-derived minPrice moves.
    expect(h.state.products[0]).toMatchObject({ name: 'غذای سگ', description: 'توضیح قبلی', minPrice: 120 });
  });
  it('rejects a race after preview and metadata edits from stale exports', async () => {
    const h = harness();
    const preview = await h.service.synchronize({ rows: [{ sku: 'SKU-1', stock: 0 }] }, true);
    if (!('rows' in preview)) throw Error('preview');
    h.state.variants[0].stock = 9;
    await expect(
      h.service.synchronize({ rows: preview.rows.map((r) => r.data) }, false),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      h.service.synchronize(
        { rows: [{ sku: 'SKU-1', name: 'نام تازه', expectedUpdatedAt: '2026-10-16T00:00:00Z' }] },
        true,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('never treats an unknown supplied ID or conflicting SKU as a new product', async () => {
    const h = harness();
    for (const row of [
      { variantId: 999, sku: 'NEW' },
      { productId: 999, sku: 'NEW' },
      { productId: 2, variantId: 11 },
      { variantId: 11, sku: 'OTHER' },
    ])
      await expect(h.service.synchronize({ rows: [row] }, true)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    expect(h.writes).not.toHaveBeenCalled();
  });
  it('rejects duplicate variant targets and inconsistent repeated product metadata', async () => {
    const h = harness();
    await expect(
      h.service.synchronize(
        {
          rows: [
            { sku: 'SKU-1', stock: 1 },
            { variantId: 11, stock: 2 },
          ],
        },
        true,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      h.service.synchronize(
        {
          rows: [
            { sku: 'SKU-1', name: 'یک نام' },
            { sku: 'SKU-2', name: 'نام دیگر' },
          ],
        },
        true,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('updates a multi-variant product once, preserves blank fields, and explicitly clears optional text', async () => {
    const h = harness();
    const review = await h.service.synchronize(
      {
        rows: [
          { sku: 'SKU-1', name: 'نام تازه', description: '__CLEAR__' },
          { sku: 'SKU-2', name: 'نام تازه', ingredientsText: '' },
        ],
      },
      true,
    );
    if (!('rows' in review)) throw Error('preview');
    await h.service.synchronize({ rows: review.rows.map((r) => r.data) }, false);
    expect(h.state.products[0]).toMatchObject({
      name: 'نام تازه',
      description: null,
      ingredientsText: null,
    });
    expect(h.state.variants).toHaveLength(2);
  });
  it('adds a new variant without deleting an existing variant or changing SKU', async () => {
    const h = harness();
    const review = await h.service.synchronize(
      { rows: [{ productId: 1, sku: 'SKU-NEW', price: 50, stock: 2, weightGram: 100 }] },
      true,
    );
    if (!('rows' in review)) throw Error('preview');
    expect(review.totals.variantsAdded).toBe(1);
    await h.service.synchronize({ rows: review.rows.map((r) => r.data) }, false);
    expect(h.state.variants).toHaveLength(3);
    expect(h.state.products[0].minPrice).toBe(50);
  });
  it('creates a new product and updates existing stock in the same reviewed operation', async () => {
    const h = harness();
    const review = await h.service.synchronize(
      {
        rows: [
          { sku: 'SKU-1', stock: 0 },
          {
            name: 'غذای جدید',
            sku: 'NEW',
            price: 150,
            weightGram: 700,
            brandId: 1,
            categoryId: 2,
            petTypeId: 3,
            isActive: true,
          },
        ],
      },
      true,
    );
    if (!('rows' in review)) throw Error('preview');
    await h.service.synchronize({ rows: review.rows.map((r) => r.data) }, false);
    expect(h.state.products).toHaveLength(2);
    expect(h.state.variants[0].stock).toBe(0);
  });
  it('rolls back all earlier writes when a later variant update fails', async () => {
    const h = harness();
    const review = await h.service.synchronize(
      {
        rows: [
          { sku: 'SKU-1', stock: 0 },
          { sku: 'SKU-2', stock: 0 },
        ],
      },
      true,
    );
    if (!('rows' in review)) throw Error('preview');
    h.failOnVariant(12);
    await expect(
      h.service.synchronize({ rows: review.rows.map((r) => r.data) }, false),
    ).rejects.toThrow('isolated DB failure');
    expect(h.state.variants.map((v) => v.stock)).toEqual([10, 5]);
  });
  it('blocks publication through incomplete references and zero-weight active variants', async () => {
    const h = harness();
    h.state.brands[0].isActive = false;
    await expect(
      h.service.synchronize({ rows: [{ sku: 'SKU-1', price: 90 }] }, true),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    h.state.products[0].isActive = false;
    await expect(
      h.service.synchronize({ rows: [{ sku: 'SKU-1', price: 90 }] }, true),
    ).resolves.toMatchObject({ totals: { updated: 1 } });
    h.state.brands[0].isActive = true;
    await expect(
      h.service.synchronize({ rows: [{ sku: 'SKU-1', weightGram: 0, isActive: true }] }, true),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('exports selected columns with filters, stable snapshots and bounded rows', async () => {
    const h = harness();
    const csv = await h.service.exportCsv({
      columns: 'productId,variantId,sku,stock,expectedStock',
      isActive: false,
      search: 'غذا',
    });
    expect(csv.split('\r\n')[0]).toBe(
      '\uFEFFcsvEncoding,productId,variantId,sku,stock,expectedStock',
    );
    expect(csv).toContain('"1","11","SKU-1","10","10"');
    expect(h.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: false, OR: expect.any(Array) }),
        take: 501,
      }),
    );
  });
  it('rejects malformed payloads, unknown keys, missing preview proof and over-limit batches', async () => {
    const h = harness();
    for (const input of [
      null,
      {},
      { rows: [] },
      { rows: [{ sku: 'SKU-1', role: 'ADMIN' }] },
      { rows: Array.from({ length: 501 }, () => ({ sku: 'SKU-1' })) },
    ])
      await expect(h.service.synchronize(input as never, true)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    await expect(
      h.service.synchronize({ rows: [{ sku: 'SKU-1', stock: 0 }] }, false),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('CSV independent audit regressions', () => {
  it('requires snapshots for variant-only writes and additions', async () => {
    const h = harness();
    for (const row of [{sku:'SKU-1',price:90},{productId:1,sku:'NEW',price:50,weightGram:100}])
      await expect(h.service.synchronize({rows:[row]},false)).rejects.toMatchObject({code:'VALIDATION_ERROR'});
    expect(h.writes).not.toHaveBeenCalled();
  });
  it('rejects names too short after Persian normalization', async () => {
    const h = harness();
    for (const name of ['\u200c\u200c','a\u200c'])
      await expect(h.service.synchronize({rows:[{sku:'SKU-1',name}]},true)).rejects.toMatchObject({code:'VALIDATION_ERROR'});
    expect(h.writes).not.toHaveBeenCalled();
  });
  it('rejects ambiguous names and invalid or colliding new reference slugs in preview', async () => {
    const h = harness(); const row = {name:'محصول تازه',sku:'NEW',price:100,categoryId:2,petTypeId:3};
    h.state.brands.push({...h.state.brands[0],id:9,slug:'other'});
    for (const brandName of ['برند','!!!','brand'])
      await expect(h.service.synchronize({rows:[{...row,brandName}]},true)).rejects.toMatchObject({code:'VALIDATION_ERROR'});
    expect(h.writes).not.toHaveBeenCalled();
  });
});

describe('Safe reversible CSV export', () => {
  it('quotes commas/newlines/quotes and neutralizes formulas plus literal apostrophes', () => {
    expect(csvCell('=1+2')).toBe('"\'=1+2"');
    expect(csvCell("'literal")).toBe('"\'\'literal"');
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(productExportCsv([], exportColumns('sku,stock'))).toBe(
      '\uFEFFcsvEncoding,sku,stock\r\n',
    );
  });
  it('rejects arbitrary or duplicate output columns', () => {
    expect(() => exportColumns('password')).toThrow();
    expect(() => exportColumns('sku,sku')).toThrow();
  });
});
