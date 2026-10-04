import { PetsService } from './pets.service';
import { MAX_PETS_PER_USER } from '../../common/constants';

/**
 * Pet creation rules: per-user limit, pet-type/breed validity, date and weight.
 */

function makePrisma(opts: { count?: number; petType?: any; breed?: any } = {}) {
  const pick = (v: unknown, d: unknown) => (v === undefined ? d : v);
  return {
    pet: {
      count: jest.fn().mockResolvedValue(opts.count ?? 0),
      create: jest
        .fn()
        .mockImplementation(async ({ data }: any) => ({ id: 1, ...data, petType: {}, breed: null })),
    },
    petType: {
      findUnique: jest
        .fn()
        .mockResolvedValue(pick(opts.petType, { id: 1, isActive: true, name: 'سگ', slug: 'dog' })),
    },
    breed: {
      findUnique: jest
        .fn()
        .mockResolvedValue(pick(opts.breed, { id: 2, isActive: true, petTypeId: 1, name: 'شیبا' })),
    },
  } as any;
}

const DATA = { name: 'رکس', petTypeId: 1 };

describe('PetsService.create', () => {
  it('enforces the per-user pet limit', async () => {
    const service = new PetsService(makePrisma({ count: MAX_PETS_PER_USER }));
    await expect(service.create(1, DATA)).rejects.toThrow(`حداکثر ${MAX_PETS_PER_USER}`);
  });

  it('validates pet type and breed ownership', async () => {
    const noType = new PetsService(makePrisma({ petType: null }));
    await expect(noType.create(1, DATA)).rejects.toThrow('نوع حیوان معتبر نیست');

    const inactiveBreed = new PetsService(makePrisma({ breed: { id: 2, isActive: false, petTypeId: 1 } }));
    await expect(inactiveBreed.create(1, { ...DATA, breedId: 2 })).rejects.toThrow('نژاد معتبر نیست');

    const wrongType = new PetsService(makePrisma({ breed: { id: 2, isActive: true, petTypeId: 9 } }));
    await expect(wrongType.create(1, { ...DATA, breedId: 2 })).rejects.toThrow('نژاد معتبر نیست');
  });

  it('rejects future birth dates and out-of-range weights', async () => {
    const service = new PetsService(makePrisma());
    await expect(service.create(1, { ...DATA, birthDate: '2999-01-01' })).rejects.toThrow('آینده');
    await expect(service.create(1, { ...DATA, weightKg: 0.05 })).rejects.toThrow('وزن');
    await expect(service.create(1, { ...DATA, weightKg: 250 })).rejects.toThrow('وزن');
  });

  it('creates a valid pet with normalized fields and lifeStage', async () => {
    const prisma = makePrisma();
    const service = new PetsService(prisma);
    const pet = await service.create(1, {
      ...DATA,
      breedId: 2,
      birthDate: '2020-01-01',
      weightKg: 12.5,
      gender: 'MALE',
    });
    expect(prisma.pet.create.mock.calls[0][0].data).toMatchObject({
      userId: 1,
      name: 'رکس',
      petTypeId: 1,
      breedId: 2,
      weightKg: 12.5,
      gender: 'MALE',
    });
    expect(pet).toHaveProperty('lifeStage');
  });
});
