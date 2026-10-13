import { PetsService } from './pets.service';

function setup(birthDate: Date | null = null, petType = { slug: 'سگ', name: 'سگ' }) {
  const stored = { id: 7, userId: 1, petTypeId: 3, breedId: 12, birthDate, tags: [], petType };
  const prisma = {
    pet: {
      findUnique: jest.fn().mockResolvedValue(stored),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        for (const [key, value] of Object.entries(data))
          if (value !== undefined) Object.assign(stored, { [key]: value });
        return stored;
      }),
    },
    petType: { findUnique: jest.fn().mockResolvedValue({ id: 4, isActive: true, name: 'گربه' }) },
    breed: { findUnique: jest.fn().mockResolvedValue({ id: 20, petTypeId: 4, isActive: true }) },
  };
  return { prisma, stored, service: new PetsService(prisma as any) };
}

describe('pet species and breed integrity during editing', () => {
  it.each([null, { id: 4, isActive: false }])(
    'rejects missing/inactive target species %p',
    async (type) => {
      const { prisma, service } = setup();
      prisma.petType.findUnique.mockResolvedValue(type as any);
      await expect(service.update(1, 7, { petTypeId: 4 })).rejects.toThrow('نوع حیوان معتبر نیست');
      expect(prisma.pet.update).not.toHaveBeenCalled();
    },
  );
  it.each([null, 0, 1.5])(
    'rejects invalid target species ID %p before database writes',
    async (petTypeId) => {
      const { prisma, service } = setup();
      await expect(service.update(1, 7, { petTypeId })).rejects.toThrow('نوع حیوان معتبر نیست');
      expect(prisma.pet.update).not.toHaveBeenCalled();
    },
  );
  it('clears the prior species breed when a new breed is omitted', async () => {
    const { service, stored } = setup();
    await service.update(1, 7, { petTypeId: 4 });
    expect(stored).toMatchObject({ petTypeId: 4, breedId: null });
  });
  it('preserves the breed when species and breed are omitted', async () => {
    const { service, stored } = setup();
    await service.update(1, 7, { name: 'باران' });
    expect(stored.breedId).toBe(12);
  });
  it('accepts an active breed belonging to the new species', async () => {
    const { service, stored } = setup();
    await service.update(1, 7, { petTypeId: 4, breedId: 20 });
    expect(stored).toMatchObject({ petTypeId: 4, breedId: 20 });
  });
  it('rejects a breed from another species even without a species change', async () => {
    const { service, prisma } = setup();
    await expect(service.update(1, 7, { breedId: 20 })).rejects.toThrow('نژاد معتبر نیست');
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });
  it('allows explicit breed clearing without changing species', async () => {
    const { service, stored } = setup();
    await service.update(1, 7, { breedId: null });
    expect(stored).toMatchObject({ petTypeId: 3, breedId: null });
  });
  it.each([
    { slug: 'bird', name: 'پرنده' },
    { slug: 'custom-bird', name: 'پرنده' },
  ])('reports unknown life stage for older birds %p', async (petType) => {
    const { service } = setup(new Date('2000-01-01'), petType);
    expect((await service.findOne(1, 7)).lifeStage).toBe('ALL');
  });
  it.each([
    { slug: 'سگ', name: 'سگ' },
    { slug: 'cat', name: 'گربه' },
  ])('preserves accepted public senior stages for %p', async (petType) => {
    const { service } = setup(new Date('2000-01-01'), petType);
    expect((await service.findOne(1, 7)).lifeStage).toBe('SENIOR');
  });
});
