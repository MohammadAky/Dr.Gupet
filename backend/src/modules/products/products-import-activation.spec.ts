import { AdminProductsService } from './admin-products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductVariantsService } from './product-variants.service';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** In-memory transactional parent lock; real SQL concurrency is verified separately. */
function harness() {
  const product = {
    id: 1,
    isActive: false,
    minPrice: 100,
    name: 'خوراک',
    brandId: 3,
    categoryId: 4,
    petTypeId: 5,
  };
  const variant = {
    id: 2,
    productId: 1,
    sku: 'IMPORTED',
    isActive: true,
    weightGram: 0,
    price: 100,
  };
  const countGate = { entered: deferred(), release: deferred(), hold: false };
  const editGate = { entered: deferred(), release: deferred(), hold: false };
  let lockTail = Promise.resolve();
  const reads: Array<{ sql: string; id: unknown }> = [];
  const productUpdate = jest.fn(async ({ data }) => {
    for (const [key, value] of Object.entries(data))
      if (value !== undefined) Object.assign(product, { [key]: value });
    return { ...product };
  });
  const variantUpdate = jest.fn(async ({ data }) => {
    if (editGate.hold) {
      editGate.entered.resolve();
      await editGate.release.promise;
    }
    for (const [key, value] of Object.entries(data))
      if (value !== undefined) Object.assign(variant, { [key]: value });
    return { ...variant };
  });
  const count = jest.fn(async () => {
    if (countGate.hold) {
      countGate.entered.resolve();
      await countGate.release.promise;
    }
    return variant.isActive && variant.weightGram <= 0 ? 1 : 0;
  });
  const variantFind = jest.fn(async ({ where }) => (where.id === 2 ? { ...variant } : null));
  const prisma = {
    product: { findUnique: jest.fn(async () => ({ ...product })) },
    productVariant: { findUnique: variantFind },
    $transaction: jest.fn(async (operation) => {
      let unlock: (() => void) | undefined;
      const tx = {
        $queryRaw: async (sql: TemplateStringsArray, id: unknown) => {
          reads.push({ sql: sql.join('?'), id });
          const prior = lockTail;
          lockTail = new Promise<void>((done) => {
            unlock = done;
          });
          await prior;
          return [{ ...product }];
        },
        brand: { findUnique: jest.fn(async () => ({ isActive: true })) },
        productCategory: {
          findUnique: jest.fn(async () => ({ isActive: true, petTypeId: product.petTypeId })),
        },
        petType: { findUnique: jest.fn(async () => ({ isActive: true })) },
        product: { update: productUpdate },
        productVariant: {
          count,
          findUnique: variantFind,
          update: variantUpdate,
          findFirst: jest.fn(async () => (variant.isActive ? { price: variant.price } : null)),
        },
      };
      try {
        return await operation(tx);
      } finally {
        unlock?.();
      }
    }),
  };
  const legacyRecalculate = jest.fn();
  const service = new AdminProductsService(
    prisma as unknown as PrismaService,
    { recalculateMinPrice: legacyRecalculate } as unknown as ProductVariantsService,
  );
  return {
    service,
    product,
    variant,
    prisma,
    reads,
    productUpdate,
    variantUpdate,
    count,
    countGate,
    editGate,
    legacyRecalculate,
  };
}

describe('Imported zero-weight invariant under the shared parent lock', () => {
  it('rejects publication with active zero weight and accepts publication after correcting it', async () => {
    const h = harness();
    await expect(h.service.update(1, { isActive: true })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(h.productUpdate).not.toHaveBeenCalled();
    await h.service.updateVariant(2, { weightGram: 100 });
    await expect(h.service.update(1, { isActive: true })).resolves.toMatchObject({
      isActive: true,
    });
    expect(h.count).toHaveBeenCalledWith({
      where: { productId: 1, isActive: true, weightGram: { lte: 0 } },
    });
  });

  it('blocks disable-variant → activate-product → re-enable-zero-weight bypass with omitted weight', async () => {
    const h = harness();
    await h.service.updateVariant(2, { isActive: false });
    await h.service.update(1, { isActive: true });
    await expect(h.service.updateVariant(2, { isActive: true })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(h.variant.isActive).toBe(false);
    expect(h.product.minPrice).toBe(0);
    await h.service.updateVariant(2, { isActive: true, weightGram: 1, price: 123456 });
    expect(h.product.minPrice).toBe(123456);
    expect(h.legacyRecalculate).not.toHaveBeenCalled();
  });

  it('allows inactive-product zero-weight edits and inactive-variant edits on a published product', async () => {
    const h = harness();
    await h.service.updateVariant(2, { price: 0 });
    expect(h.product.minPrice).toBe(0);
    await h.service.updateVariant(2, { isActive: false });
    await h.service.update(1, { isActive: true });
    await h.service.updateVariant(2, { price: 20 });
    expect(h.variant.weightGram).toBe(0);
    expect(h.product.minPrice).toBe(0);
  });

  it('serializes variant enable behind publication check/write and rejects its effective zero weight', async () => {
    const h = harness();
    h.variant.isActive = false;
    h.countGate.hold = true;
    const publish = h.service.update(1, { isActive: true });
    await h.countGate.entered.promise;
    const enable = h.service.updateVariant(2, { isActive: true });
    const rejected = expect(enable).rejects.toMatchObject({ code: 'CONFLICT' });
    await Promise.resolve();
    await Promise.resolve();
    expect(h.variantUpdate).not.toHaveBeenCalled();
    h.countGate.release.resolve();
    await publish;
    await rejected;
    expect(h.product.isActive).toBe(true);
    expect(h.variant.isActive).toBe(false);
    expect(h.reads).toHaveLength(2);
    expect(h.reads.every((read) => read.id === 1 && /Product.*FOR UPDATE/.test(read.sql))).toBe(
      true,
    );
  });

  it('serializes publication behind an in-flight zero-weight enable and rejects the new state', async () => {
    const h = harness();
    h.variant.isActive = false;
    h.editGate.hold = true;
    const enable = h.service.updateVariant(2, { isActive: true });
    await h.editGate.entered.promise;
    const publish = h.service.update(1, { isActive: true });
    const rejected = expect(publish).rejects.toMatchObject({ code: 'CONFLICT' });
    await Promise.resolve();
    await Promise.resolve();
    expect(h.count).not.toHaveBeenCalled();
    h.editGate.release.resolve();
    await enable;
    await rejected;
    expect(h.product.isActive).toBe(false);
    expect(h.variant.isActive).toBe(true);
  });
});
