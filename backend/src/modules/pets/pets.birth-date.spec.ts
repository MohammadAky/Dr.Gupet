import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PetsService } from './pets.service';
import { UpdatePetDto } from './dto/update-pet.dto';
import { CreatePetDto } from './dto/create-pet.dto';

function setup() {
  const stored = { id: 7, userId: 1, petTypeId: 2, birthDate: new Date('2020-01-01'), tags: [] };
  const prisma = {
    petType: {
      findUnique: jest.fn().mockResolvedValue({ id: 2, isActive: true, slug: 'dog' }),
    },
    pet: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 8,
        ...data,
        petType: { slug: 'dog' },
      })),
      findUnique: jest.fn().mockResolvedValue(stored),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        for (const [key, value] of Object.entries(data))
          if (value !== undefined) Object.assign(stored, { [key]: value });
        return stored;
      }),
    },
  };
  return { stored, prisma, service: new PetsService(prisma as any) };
}

describe('pet birth date editing contract', () => {
  it('clears the existing date with explicit null and stops inferring a life stage', async () => {
    const { service, stored, prisma } = setup();
    const response = await service.update(1, 7, { birthDate: null });
    expect(prisma.pet.update.mock.calls[0][0].data.birthDate).toBeNull();
    expect(stored.birthDate).toBeNull();
    expect(response.lifeStage).toBe('ALL');
  });
  it('preserves the existing date when the field is omitted', async () => {
    const { service, stored } = setup();
    await service.update(1, 7, { name: 'باران' });
    expect(stored.birthDate).toEqual(new Date('2020-01-01'));
  });
  it('stores a valid replacement date', async () => {
    const { service, stored } = setup();
    await service.update(1, 7, { birthDate: '2022-01-01' });
    expect(stored.birthDate).toEqual(new Date('2022-01-01'));
  });
  it.each(['not-a-date', '2999-01-01'])(
    'rejects invalid/future value %s without writing',
    async (birthDate) => {
      const { service, prisma } = setup();
      await expect(service.update(1, 7, { birthDate })).rejects.toThrow();
      expect(prisma.pet.update).not.toHaveBeenCalled();
    },
  );
  it('keeps the ownership guard before any write', async () => {
    const { service, prisma } = setup();
    await expect(service.update(2, 7, { birthDate: null })).rejects.toThrow('حیوان یافت نشد');
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });
  it.each([{}, { birthDate: null }, { birthDate: '2022-01-01' }])(
    'allows omitted, null, or valid ISO date at the DTO boundary: %p',
    async (payload) => {
      expect(await validate(plainToInstance(UpdatePetDto, payload))).toHaveLength(0);
    },
  );
  it.each(['', 'not-a-date', '2022-02-30', 12])(
    'rejects malformed dates at the DTO boundary: %p',
    async (birthDate) => {
      expect(await validate(plainToInstance(UpdatePetDto, { birthDate }))).not.toHaveLength(0);
    },
  );
});

describe('Tehran civil-day boundary for date-only pet birthdays', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const clocks = [
    { now: '2026-10-12T20:29:59.000Z', todayAllowed: false, local: '23:59:59 previous day' },
    { now: '2026-10-12T20:30:00.000Z', todayAllowed: true, local: '00:00:00 today' },
    { now: '2026-10-12T23:59:59.000Z', todayAllowed: true, local: '03:29:59 today' },
    { now: '2026-10-13T00:00:00.000Z', todayAllowed: true, local: '03:30:00 today' },
  ];

  it.each(clocks)('validates creation by Tehran day at $local', async ({ now, todayAllowed }) => {
    jest.setSystemTime(new Date(now));
    const { service, prisma } = setup();
    const payload = plainToInstance(CreatePetDto, {
      name: 'باران',
      petTypeId: 2,
      birthDate: '2026-10-13',
    });
    expect(await validate(payload)).toHaveLength(0);
    if (todayAllowed) {
      await expect(service.create(1, payload)).resolves.toBeDefined();
      expect(prisma.pet.create.mock.calls[0][0].data.birthDate).toEqual(
        new Date('2026-10-13T00:00:00.000Z'),
      );
    } else {
      await expect(service.create(1, payload)).rejects.toThrow('آینده');
      expect(prisma.pet.create).not.toHaveBeenCalled();
    }
  });

  it.each(clocks)('validates editing by Tehran day at $local', async ({ now, todayAllowed }) => {
    jest.setSystemTime(new Date(now));
    const { service, prisma } = setup();
    const payload = plainToInstance(UpdatePetDto, { birthDate: '2026-10-13' });
    expect(await validate(payload)).toHaveLength(0);
    if (todayAllowed) {
      await expect(service.update(1, 7, payload)).resolves.toBeDefined();
      expect(prisma.pet.update.mock.calls[0][0].data.birthDate).toEqual(
        new Date('2026-10-13T00:00:00.000Z'),
      );
    } else {
      await expect(service.update(1, 7, payload)).rejects.toThrow('آینده');
      expect(prisma.pet.update).not.toHaveBeenCalled();
    }
  });

  it.each(clocks)('continues rejecting a future day without writes at $local', async ({ now }) => {
    jest.setSystemTime(new Date(now));
    const { service, prisma } = setup();
    await expect(
      service.create(1, { name: 'باران', petTypeId: 2, birthDate: '2026-10-14' }),
    ).rejects.toThrow('آینده');
    await expect(service.update(1, 7, { birthDate: '2026-10-14' })).rejects.toThrow('آینده');
    expect(prisma.pet.create).not.toHaveBeenCalled();
    expect(prisma.pet.update).not.toHaveBeenCalled();
  });
});

describe('Creation birthday validation agrees with editing', () => {
  it('rejects a non-existent February day before the service can normalize it', async () => {
    const payload = plainToInstance(CreatePetDto, {
      name: 'باران',
      petTypeId: 2,
      birthDate: '2022-02-30',
    });
    const errors = await validate(payload);
    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'birthDate' })]),
    );
  });

  it('continues accepting the leap day in a valid leap year', async () => {
    const payload = plainToInstance(CreatePetDto, {
      name: 'باران',
      petTypeId: 2,
      birthDate: '2024-02-29',
    });
    expect(await validate(payload)).toHaveLength(0);
  });
});
