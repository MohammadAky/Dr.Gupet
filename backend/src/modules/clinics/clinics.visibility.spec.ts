import { NotFoundException } from '@nestjs/common';
import { ClinicsService } from './clinics.service';

const fixtures = [
  {
    id: 1,
    name: 'کلینیک فعال',
    slug: 'active-clinic',
    isActive: true,
    isVerified: true,
    city: 'تهران',
    province: 'تهران',
    is24h: false,
  },
  {
    id: 2,
    name: 'کلینیک غیرفعال',
    slug: 'inactive-clinic',
    isActive: false,
    isVerified: false,
    city: 'تهران',
    province: 'تهران',
    is24h: true,
  },
];

function matchesClinic(c: any, where: any) {
  for (const [key, value] of Object.entries(where ?? {})) {
    if (value === undefined) continue;
    if (c[key] !== value) return false;
  }
  return true;
}

function makeService() {
  const prisma: any = {
    clinic: {
      findMany: jest.fn().mockImplementation(async (args: any) => {
        return fixtures
          .filter((c) => matchesClinic(c, args.where))
          .slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? fixtures.length));
      }),
      count: jest
        .fn()
        .mockImplementation(
          async (args: any) => fixtures.filter((c) => matchesClinic(c, args.where)).length,
        ),
      findUnique: jest.fn().mockImplementation(async (args: any) => {
        return fixtures.find((f) => matchesClinic(f, args.where)) ?? null;
      }),
      update: jest.fn(),
    },
  };
  return { service: new ClinicsService(prisma), prisma };
}

describe('Clinic visibility — admin vs public (issue #6)', () => {
  it('admin list includes inactive clinics', async () => {
    const { service } = makeService();
    const result = await service.findAllAdmin({ page: 1, limit: 20 });
    const ids = result.data.map((i: any) => i.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2); // inactive is visible to admin
  });

  it('admin list paginates and reports total including inactive', async () => {
    const { service } = makeService();
    const result = await service.findAllAdmin({ page: 1, limit: 20 });
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('admin list can filter by isActive=false', async () => {
    const { service } = makeService();
    const result = await service.findAllAdmin({ page: 1, limit: 20, isActive: false });
    expect(result.data.map((i: any) => i.id)).toEqual([2]);
  });

  it('public list hides inactive clinics', async () => {
    const { service } = makeService();
    const result = await service.findAll({ page: 1, limit: 20, is24h: true } as any);
    // fixture 2 is 24h but inactive → must not appear
    expect(result.data.map((i: any) => i.id)).not.toContain(2);
    expect(result.data.map((i: any) => i.id)).toEqual([]);
  });

  it('public lookup of an inactive clinic returns 404', async () => {
    const { service } = makeService();
    await expect(service.findOne(2)).rejects.toThrow(NotFoundException);
    // the active one is still visible
    await expect(service.findOne(1)).resolves.toMatchObject({ id: 1 });
  });

  it('admin can reactivate an inactive clinic', async () => {
    const { service, prisma } = makeService();
    prisma.clinic.update.mockResolvedValue({ ...fixtures[1], isActive: true });
    const result = await service.update(2, { isActive: true });
    expect(result.isActive).toBe(true);
    expect(prisma.clinic.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { isActive: true },
    });
  });
});
