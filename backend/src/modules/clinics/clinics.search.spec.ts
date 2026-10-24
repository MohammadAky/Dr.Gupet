import { ClinicsService } from './clinics.service';
import { PharmaciesService } from '../pharmacies/pharmacies.service';

/**
 * Issue #14 — directory name search (`q`) for the global header suggestions.
 * The services already normalized Persian/Arabic letters; these tests pin the
 * contract (active-only, substring on the normalized name, combinable with
 * city/province, paged) so the query DTO and the filter cannot drift apart.
 */
function clinicsHarness() {
  const rows = [{ id: 3, name: 'کلینیک دامپزشکی رویش' }];
  const prisma = {
    clinic: {
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(1),
    },
  };
  return { service: new ClinicsService(prisma as any), prisma };
}

function pharmaciesHarness() {
  const rows = [{ id: 9, name: 'داروخانه شبانه‌روزی رویش' }];
  const prisma = {
    pharmacy: {
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(1),
    },
  };
  return { service: new PharmaciesService(prisma as any), prisma };
}

describe('directory name search (issue #14)', () => {
  it('filters public clinics by the normalized name and keeps active-only rows', async () => {
    const h = clinicsHarness();
    const result = await h.service.findAll({ q: '  رَویش  ', limit: 5 } as any);
    expect(h.prisma.clinic.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, name: { contains: '  رَویش  ' } },
        take: 5,
      }),
    );
    expect(result).toMatchObject({ data: [{ id: 3 }], meta: { total: 1, page: 1, limit: 5 } });
  });

  it('normalizes Arabic yeh/kaf and zero-width characters in the search term', async () => {
    const h = clinicsHarness();
    await h.service.findAll({ q: 'كلينيك\u200cرويش' } as any);
    expect(h.prisma.clinic.findMany.mock.calls[0][0].where.name).toEqual({
      contains: 'کلینیکرویش',
    });
  });

  it('combines q with city and province filters', async () => {
    const h = clinicsHarness();
    await h.service.findAll({ q: 'رویش', city: 'مشهد', province: 'خراسان رضوی' } as any);
    expect(h.prisma.clinic.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      name: { contains: 'رویش' },
      city: { contains: 'مشهد' },
      province: { contains: 'خراسان رضوی' },
    });
  });

  it('searches pharmacies the same way and never fetches inactive rows', async () => {
    const h = pharmaciesHarness();
    const result = await h.service.findAll({ q: 'رویش', onDuty: true } as any);
    expect(h.prisma.pharmacy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, name: { contains: 'رویش' }, onDuty: true },
      }),
    );
    expect(result.meta.total).toBe(1);
  });

  it('keeps pagination and returns an empty page when nothing matches', async () => {
    const h = clinicsHarness();
    h.prisma.clinic.findMany.mockResolvedValue([]);
    h.prisma.clinic.count.mockResolvedValue(0);
    const result = await h.service.findAll({ q: 'ناموجود', page: 3, limit: 5 } as any);
    expect(h.prisma.clinic.findMany.mock.calls[0][0]).toMatchObject({ skip: 10, take: 5 });
    expect(result).toMatchObject({ data: [], meta: { total: 0, page: 3, limit: 5, totalPages: 0 } });
  });

  it('admin lists can search inactive rows by name too', async () => {
    const h = clinicsHarness();
    await h.service.findAllAdmin({ q: 'رویش' } as any);
    expect(h.prisma.clinic.findMany.mock.calls[0][0].where.name).toEqual({ contains: 'رویش' });
  });
});
