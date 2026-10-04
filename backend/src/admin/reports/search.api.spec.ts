import { BrandsService } from '../../modules/brands/brands.service';
import { PetTypesService } from '../../modules/pet-types/pet-types.service';
import { BreedsService } from '../../modules/breeds/breeds.service';
import { TagsService } from '../../modules/tags/tags.service';
import { CategoriesService } from '../../modules/categories/categories.service';
import { ClinicsService } from '../../modules/clinics/clinics.service';
import { PharmaciesService } from '../../modules/pharmacies/pharmacies.service';

/**
 * Part (c) — search APIs: reference entities accept `search`/`isActive`
 * (admin CatalogReferences contract), clinics/pharmacies accept `q`.
 */

function findManySpy(rows: unknown[] = []) {
  return jest.fn().mockResolvedValue(rows);
}

function prismaWith(model: string, findMany: jest.Mock) {
  return { [model]: { findMany, count: jest.fn().mockResolvedValue(0) } } as any;
}

describe('reference entity admin search (search + isActive)', () => {
  it('BrandsService.findAllAdmin filters by name/slug and isActive', async () => {
    const findMany = findManySpy();
    const service = new BrandsService(prismaWith('brand', findMany));
    await service.findAllAdmin({ search: 'royal', isActive: true });
    const where = findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.OR).toEqual([
      { name: { contains: expect.any(String) } },
      { slug: { contains: expect.any(String) } },
    ]);
  });

  it('PetTypesService.findAllAdmin accepts the same options', async () => {
    const findMany = findManySpy();
    const service = new PetTypesService(prismaWith('petType', findMany));
    await service.findAllAdmin({ search: 'dog', isActive: false });
    expect(findMany.mock.calls[0][0].where).toMatchObject({ isActive: false });
  });

  it('BreedsService.findAllAdmin combines petTypeId with search', async () => {
    const findMany = findManySpy();
    const service = new BreedsService(prismaWith('breed', findMany));
    await service.findAllAdmin(4, { search: 'shiba' });
    const where = findMany.mock.calls[0][0].where;
    expect(where.petTypeId).toBe(4);
    expect(where.OR).toHaveLength(2);
  });

  it('CategoriesService.findAllAdmin combines petTypeId with search/isActive', async () => {
    const findMany = findManySpy();
    const service = new CategoriesService(prismaWith('productCategory', findMany));
    await service.findAllAdmin(2, { search: 'غذا', isActive: true });
    expect(findMany.mock.calls[0][0].where).toMatchObject({ petTypeId: 2, isActive: true });
  });

  it('TagsService.findAllAdmin filters by type and search (Tag has no isActive)', async () => {
    const findMany = findManySpy();
    const service = new TagsService(prismaWith('tag', findMany));
    await service.findAllAdmin('DIET', { search: 'grain', isActive: true });
    const where = findMany.mock.calls[0][0].where;
    expect(where.type).toBe('DIET');
    expect(where.OR).toHaveLength(2);
    expect(where).not.toHaveProperty('isActive');
  });

  it('empty options leave the where clause empty (backwards compatible)', async () => {
    const findMany = findManySpy();
    const service = new BrandsService(prismaWith('brand', findMany));
    await service.findAllAdmin();
    expect(findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe('public q search for clinics and pharmacies (part c)', () => {
  function locationPrisma(model: string) {
    const findMany = findManySpy([{}]);
    const prisma = prismaWith(model, findMany);
    return { prisma, findMany };
  }

  it('ClinicsService.findAll searches by name and keeps isActive=true', async () => {
    const { prisma, findMany } = locationPrisma('clinic');
    const service = new ClinicsService(prisma);
    await service.findAll({ page: 1, limit: 20, q: 'کلینیک پارس' } as any);
    const where = findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.name).toEqual({ contains: expect.any(String) });
  });

  it('PharmaciesService.findAll searches by name alongside city filters', async () => {
    const { prisma, findMany } = locationPrisma('pharmacy');
    const service = new PharmaciesService(prisma);
    await service.findAll({ page: 1, limit: 20, q: 'شبانه', city: 'تهران' } as any);
    const where = findMany.mock.calls[0][0].where;
    expect(where.name).toBeTruthy();
    expect(where.city).toBeTruthy();
    expect(where.isActive).toBe(true);
  });
});
