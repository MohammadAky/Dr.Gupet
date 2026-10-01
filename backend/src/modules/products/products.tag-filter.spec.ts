import { ProductsService } from './products.service';

/**
 * In-memory evaluator for the Prisma `where` used by ProductsService.findAll.
 * Supports the tag filter shape: AND: [{ tags: { some: { tagId, kind } } }, ...]
 */
function matchesWhere(product: any, where: any): boolean {
  if (where.isActive !== undefined && product.isActive !== where.isActive) return false;

  const and: any[] = where.AND ?? [];
  for (const clause of and) {
    const some = clause?.tags?.some;
    if (some) {
      const has = (product.tags ?? []).some(
        (t: any) =>
          (some.tagId === undefined || t.tagId === some.tagId) &&
          (some.kind === undefined || t.kind === some.kind),
      );
      if (!has) return false;
    }
  }
  return true;
}

const TAG_DOG = { tagId: 5, kind: 'SUITABLE_FOR' };
const TAG_PUPPY = { tagId: 6, kind: 'SUITABLE_FOR' };
const TAG_SALE = { tagId: 9, kind: 'OTHER' };

function product(id: number, tags: any[]) {
  return {
    id,
    name: `product-${id}`,
    slug: `product-${id}`,
    isActive: true,
    brand: { id: 1, name: 'brand' },
    images: [{ url: 'img' }],
    tags,
    variants: [{ price: 1000, compareAtPrice: null, stock: 5 }],
    lifeStage: 'ADULT',
    sizeClass: 'M',
    createdAt: new Date(),
  };
}

function makeService(fixtures: any[]) {
  const captured: { where?: any } = {};
  const prisma = {
    product: {
      findMany: jest.fn().mockImplementation(async (args: any) => {
        captured.where = args.where;
        return fixtures.filter((p) => matchesWhere(p, args.where));
      }),
      count: jest
        .fn()
        .mockImplementation(
          async (args: any) => fixtures.filter((p) => matchesWhere(p, args.where)).length,
        ),
    },
  };
  const service = new ProductsService(prisma as any);
  return { service, captured };
}

describe('Product tagIds filter — SUITABLE_FOR semantics (issue #4)', () => {
  const fixtures = [
    product(1, [TAG_DOG]), // only dog
    product(2, [TAG_DOG, TAG_PUPPY]), // dog + puppy
    product(3, [TAG_DOG, TAG_PUPPY, TAG_SALE]), // dog + puppy + extra tag
    product(4, [TAG_SALE]), // unrelated tag only
    product(5, []), // no tags
  ];

  it('without tagIds every active product is returned', async () => {
    const { service, captured } = makeService(fixtures);
    const result = await service.findAll({ page: 1, limit: 20 } as any);
    expect(result.data.map((i: any) => i.id)).toEqual([1, 2, 3, 4, 5]);
    expect(captured.where.AND).toBeUndefined();
  });

  it('with one tag only products carrying that SUITABLE_FOR tag are returned', async () => {
    const { service } = makeService(fixtures);
    const result = await service.findAll({ page: 1, limit: 20, tagIds: '5' } as any);
    expect(result.data.map((i: any) => i.id).sort()).toEqual([1, 2, 3]);
  });

  it('requires EVERY selected tag; extra tags on the product do not exclude it', async () => {
    const { service } = makeService(fixtures);
    // both dog(5) AND puppy(6) required → only 2 and 3 (3 has an extra tag and must stay)
    const result = await service.findAll({ page: 1, limit: 20, tagIds: '5,6' } as any);
    expect(result.data.map((i: any) => i.id).sort()).toEqual([2, 3]);
    // product 4 has tag 9 (not in selection) — excluded; product 1 missing tag 6 — excluded
  });

  it('only SUITABLE_FOR tags count (OTHER kind does not match)', async () => {
    const { service, captured } = makeService(fixtures);
    await service.findAll({ page: 1, limit: 20, tagIds: '5,6' } as any);
    for (const clause of captured.where.AND) {
      expect(clause.tags.some.kind).toBe('SUITABLE_FOR');
    }
  });
});
