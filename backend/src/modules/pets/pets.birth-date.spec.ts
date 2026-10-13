import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PetsService } from './pets.service';
import { UpdatePetDto } from './dto/update-pet.dto';

function setup() {
  const stored = { id: 7, userId: 1, petTypeId: 2, birthDate: new Date('2020-01-01'), tags: [] };
  const prisma = {
    pet: {
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
