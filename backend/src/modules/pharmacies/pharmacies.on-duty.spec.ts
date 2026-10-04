import { PharmaciesService } from './pharmacies.service';

/**
 * Issue #08 — pharmacy onDuty flag must survive create/update, and updates
 * must only map whitelisted fields into Prisma (raw body never lands as-is).
 */

function makePrisma() {
  return {
    pharmacy: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, name: 'داروخانه شبانه‌روزی' }),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 3, ...data })),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 3, ...data })),
    },
  } as any;
}

function makeService(prisma: any) {
  return new PharmaciesService(prisma);
}

const BASE = {
  name: 'داروخانه شبانه‌روزی',
  province: 'تهران',
  city: 'تهران',
  address: 'خیابان آزادی ۱',
};

describe('PharmaciesService.create (issue #08)', () => {
  it('persists onDuty explicitly (previously dropped)', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.create({ ...BASE, onDuty: true });
    expect(prisma.pharmacy.create.mock.calls[0][0].data).toMatchObject({ onDuty: true });
  });

  it('defaults onDuty/is24h to false and isActive to true', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.create(BASE);
    expect(prisma.pharmacy.create.mock.calls[0][0].data).toMatchObject({
      onDuty: false,
      is24h: false,
      isActive: true,
    });
  });
});

describe('PharmaciesService.update (issue #08)', () => {
  it('updates onDuty and maps only whitelisted fields', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await service.update(3, {
      onDuty: false,
      is24h: true,
      // smuggled junk must never reach Prisma
      ...({ id: 999, createdAt: 'x', _count: {}, evil: 'payload' } as any),
    });
    const data = prisma.pharmacy.update.mock.calls[0][0].data;
    expect(data).toEqual({ onDuty: false, is24h: true });
    expect(data).not.toHaveProperty('evil');
    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('createdAt');
  });

  it('throws 404 for unknown pharmacies', async () => {
    const prisma = makePrisma();
    prisma.pharmacy.findUnique = jest.fn().mockResolvedValue(null);
    const service = makeService(prisma);
    await expect(service.update(404, { onDuty: true })).rejects.toThrow('داروخانه یافت نشد');
    expect(prisma.pharmacy.update).not.toHaveBeenCalled();
  });
});
