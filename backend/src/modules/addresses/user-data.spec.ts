import { AddressesService } from './addresses.service';
import { FavoritesService } from '../favorites/favorites.service';
import { MAX_ADDRESSES_PER_USER } from '../../common/constants';

/**
 * Addresses: per-user limit, first address becomes default.
 * Favorites: idempotent add/remove, active-product check.
 */

describe('AddressesService.create', () => {
  function makePrisma(count: number) {
    return {
      address: {
        count: jest.fn().mockResolvedValue(count),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 1, ...data })),
      },
    } as any;
  }

  it('enforces the per-user address limit', async () => {
    const service = new AddressesService(makePrisma(MAX_ADDRESSES_PER_USER));
    await expect(service.create(1, { title: 'خانه' })).rejects.toThrow(
      `حداکثر ${MAX_ADDRESSES_PER_USER}`,
    );
  });

  it('makes the first address the default and later ones non-default', async () => {
    const first = new AddressesService(makePrisma(0));
    await first.create(1, { title: 'خانه' });
    const secondPrisma = makePrisma(1);
    const second = new AddressesService(secondPrisma);
    await second.create(1, { title: 'محل کار' });

    expect((first as any).prisma.address.create.mock.calls[0][0].data.isDefault).toBe(true);
    expect(secondPrisma.address.create.mock.calls[0][0].data.isDefault).toBe(false);
  });
});

describe('FavoritesService add/remove', () => {
  function makePrisma(opts: { product?: any; favorite?: any } = {}) {
    const pick = (v: unknown, d: unknown) => (v === undefined ? d : v);
    return {
      product: {
        findUnique: jest
          .fn()
          .mockResolvedValue(pick(opts.product, { id: 3, isActive: true })),
      },
      favorite: {
        findUnique: jest.fn().mockResolvedValue(pick(opts.favorite, null)),
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    } as any;
  }

  it('rejects missing or inactive products', async () => {
    const service = new FavoritesService(makePrisma({ product: null }));
    await expect(service.add(1, 3)).rejects.toThrow('محصول یافت نشد');
    const inactive = new FavoritesService(makePrisma({ product: { id: 3, isActive: false } }));
    await expect(inactive.add(1, 3)).rejects.toThrow('محصول یافت نشد');
  });

  it('add is idempotent — no duplicate rows', async () => {
    const prisma = makePrisma({ favorite: { userId_productId: { userId: 1, productId: 3 } } });
    const service = new FavoritesService(prisma);
    await expect(service.add(1, 3)).resolves.toEqual({ ok: true });
    expect(prisma.favorite.create).not.toHaveBeenCalled();
  });

  it('remove is idempotent and deletes when present', async () => {
    const absent = makePrisma();
    await expect(new FavoritesService(absent).remove(1, 3)).resolves.toEqual({ ok: true });
    expect(absent.favorite.delete).not.toHaveBeenCalled();

    const present = makePrisma({ favorite: { userId_productId: { userId: 1, productId: 3 } } });
    await expect(new FavoritesService(present).remove(1, 3)).resolves.toEqual({ ok: true });
    expect(present.favorite.delete).toHaveBeenCalledWith({
      where: { userId_productId: { userId: 1, productId: 3 } },
    });
  });
});
