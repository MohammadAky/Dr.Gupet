import { ProductsRecommendationService } from './products-recommendation.service';

describe('recommendation species and tag semantics', () => {
  function setup(slug: string, name: string, birthDate: Date | null = null, isNeutered = false) {
    const prisma = {
      pet: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 1,
          petTypeId: 3,
          petType: { slug, name },
          birthDate,
          weightKg: 8,
          isNeutered,
          tags: [
            { tag: { id: 7, type: 'ALLERGEN', slug: 'مرغ' } },
            { tag: { id: 9, type: 'DIET', slug: 'sensitive-digestion' } },
          ],
        }),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 4,
            name: 'غذا',
            slug: 'food',
            brand: {},
            images: [],
            variants: [{ price: 200000 }],
            lifeStage: 'ALL',
            sizeClass: 'ALL',
            tags: [{ tag: { id: 9, name: 'هضم حساس' } }],
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    return { prisma, service: new ProductsRecommendationService(prisma as any) };
  }
  it.each([
    ['dog', 'سگ'],
    ['سگ', 'سگ'],
    ['custom-dog-reference', 'سگ'],
  ])(
    'keeps dog weight filtering for canonical and owner-created reference %s',
    async (slug, name) => {
      const { service, prisma } = setup(slug, name);
      const response = await service.findForPet(1, 6);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            petTypeId: 3,
            sizeClass: { in: ['SMALL', 'ALL'] },
            tags: { none: { tagId: { in: [7] }, kind: 'CONTAINS' } },
          }),
        }),
      );
      expect(response.data[0].matchedTags).toEqual(['هضم حساس']);
    },
  );
  it.each([
    ['cat', 'گربه'],
    ['bird', 'پرنده'],
  ])('never applies dog size classes to %s', async (slug, name) => {
    const { service, prisma } = setup(slug, name);
    await service.findForPet(1, 6);
    expect(prisma.product.findMany.mock.calls[0][0].where).not.toHaveProperty('sizeClass');
  });
  it.each([
    ['bird', 'پرنده'],
    ['custom-bird', 'پرنده'],
  ])('does not infer a dog/cat senior stage for an older bird %s', async (slug, name) => {
    const { service, prisma } = setup(slug, name, new Date('2000-01-01'));
    await service.findForPet(1, 6);
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('lifeStage');
    expect(where).not.toHaveProperty('sizeClass');
    expect(where).toMatchObject({
      petTypeId: 3,
      tags: { none: { tagId: { in: [7] }, kind: 'CONTAINS' } },
    });
  });
  it.each([
    ['سگ', 'سگ'],
    ['cat', 'گربه'],
  ])('preserves accepted senior thresholds for %s', async (slug, name) => {
    const { service, prisma } = setup(slug, name, new Date('2000-01-01'));
    await service.findForPet(1, 6);
    expect(prisma.product.findMany.mock.calls[0][0].where.lifeStage).toEqual({
      in: ['SENIOR', 'ALL'],
    });
  });
  it('does not infer dog/cat neuter suitability for birds', async () => {
    const { service, prisma } = setup('bird', 'پرنده', new Date('2000-01-01'), true);
    await service.findForPet(1, 6);
    expect(prisma.product.findMany.mock.calls[0][0].where).not.toHaveProperty('neuterSuitability');
  });
  it.each([
    ['سگ', 'سگ'],
    ['cat', 'گربه'],
  ])('preserves accepted neuter suitability for %s', async (slug, name) => {
    const { service, prisma } = setup(slug, name, null, true);
    await service.findForPet(1, 6);
    expect(prisma.product.findMany.mock.calls[0][0].where.neuterSuitability).toEqual({
      in: ['ANY', 'NEUTERED_ONLY'],
    });
  });
});
