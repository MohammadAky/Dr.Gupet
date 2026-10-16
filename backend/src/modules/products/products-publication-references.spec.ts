import { AdminProductsService } from './admin-products.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ProductVariantsService } from './product-variants.service';

function harness() {
  const product = {
    id: 7,
    name: 'نیازمند تکمیل',
    isActive: false,
    brandId: 1,
    categoryId: 2,
    petTypeId: 3,
  };
  const references = {
    brand: { isActive: true },
    category: { isActive: true, petTypeId: 3 as number | null },
    petType: { isActive: true },
  };
  const tx = {
    $queryRaw: jest.fn(async () => [{ ...product }]),
    brand: { findUnique: jest.fn(async () => references.brand) },
    productCategory: { findUnique: jest.fn(async () => references.category) },
    petType: { findUnique: jest.fn(async () => references.petType) },
    productVariant: { count: jest.fn(async () => 0) },
    product: {
      update: jest.fn(async ({ data }) => ({ ...product, ...data })),
      create: jest.fn(async ({ data }) => ({ id: 8, ...data })),
    },
  };
  const prisma = {
    product: { findUnique: jest.fn(async ({ where }) => (where.id ? { ...product } : null)) },
    brand: { findUnique: jest.fn(async () => ({ id: 1 })) },
    productCategory: { findUnique: jest.fn(async () => ({ id: 2 })) },
    petType: { findUnique: jest.fn(async () => ({ id: 3 })) },
    $transaction: jest.fn(async (operation) => operation(tx)),
  };
  const service = new AdminProductsService(
    prisma as unknown as PrismaService,
    {} as ProductVariantsService,
  );
  return { service, product, references, tx, prisma };
}

describe('Published products require complete active and compatible references', () => {
  it.each(['brand', 'category', 'petType'] as const)(
    'blocks publishing a draft with inactive %s even when only the toggle is submitted',
    async (reference) => {
      const h = harness();
      h.references[reference].isActive = false;
      await expect(h.service.update(7, { isActive: true })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      expect(h.tx.$queryRaw).toHaveBeenCalled();
      expect(h.tx.product.update).not.toHaveBeenCalled();
    },
  );
  it('uses reference IDs read under the product lock rather than the stale preflight product', async () => {
    const h = harness();
    h.references.petType.isActive = false;
    h.tx.$queryRaw.mockResolvedValueOnce([{ ...h.product, petTypeId: 99 }]);
    await expect(h.service.update(7, { isActive: true })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(h.tx.petType.findUnique).toHaveBeenCalledWith({
      where: { id: 99 },
      select: { isActive: true },
    });
  });
  it('blocks incompatible category/species on an already-published product even without a publication toggle', async () => {
    const h = harness();
    h.product.isActive = true;
    await expect(h.service.update(7, { petTypeId: 9 })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(h.tx.product.update).not.toHaveBeenCalled();
  });
  it('permits compatible global categories and honors effective row replacements', async () => {
    const h = harness();
    h.references.category.petTypeId = null;
    await expect(
      h.service.update(7, { brandId: 10, categoryId: 11, petTypeId: 12, isActive: true }),
    ).resolves.toMatchObject({ isActive: true });
    expect(h.tx.brand.findUnique).toHaveBeenCalledWith({
      where: { id: 10 },
      select: { isActive: true },
    });
    expect(h.tx.productCategory.findUnique).toHaveBeenCalledWith({
      where: { id: 11 },
      select: { isActive: true, petTypeId: true },
    });
    expect(h.tx.petType.findUnique).toHaveBeenCalledWith({
      where: { id: 12 },
      select: { isActive: true },
    });
  });
  it('keeps incomplete drafts editable and permits suspending an active product without reactivating any reference', async () => {
    const h = harness();
    h.references.brand.isActive = false;
    await h.service.update(7, { name: 'نیازمند تکمیل - ویرایش' });
    h.product.isActive = true;
    await h.service.update(7, { isActive: false });
    expect(h.tx.brand.findUnique).not.toHaveBeenCalled();
    expect(h.references.brand.isActive).toBe(false);
  });
  it('rejects missing effective references before the product write', async () => {
    const h = harness();
    h.tx.brand.findUnique.mockResolvedValueOnce(null as never);
    await expect(h.service.update(7, { isActive: true })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(h.tx.product.update).not.toHaveBeenCalled();
  });
  it('applies the same active-reference guard to default-active creates but allows an explicit incomplete draft', async () => {
    const h = harness();
    h.references.brand.isActive = false;
    const dto = { name: 'نیازمند تکمیل', brandId: 1, categoryId: 2, petTypeId: 3 };
    await expect(h.service.create(dto)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(h.tx.product.create).not.toHaveBeenCalled();
    await expect(h.service.create({ ...dto, isActive: false })).resolves.toMatchObject({
      isActive: false,
    });
    expect(h.tx.product.create).toHaveBeenCalledTimes(1);
    expect(h.references.brand.isActive).toBe(false);
  });
});
