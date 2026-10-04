import { CartService } from './cart.service';
import { MAX_CART_ITEM_QTY } from '../../common/constants';

/**
 * Cart rules: variant availability, stock checks, quantity cap, merging.
 */

function makePrisma(opts: { variant?: any; existingItem?: any; cart?: any } = {}) {
  const pick = (v: unknown, d: unknown) => (v === undefined ? d : v);
  return {
    productVariant: {
      findUnique: jest.fn().mockResolvedValue(
        pick(opts.variant, {
          id: 11,
          isActive: true,
          stock: 10,
          product: { isActive: true },
        }),
      ),
    },
    cart: {
      findUnique: jest.fn().mockResolvedValue(pick(opts.cart, { id: 100, userId: 1 })),
      create: jest.fn().mockResolvedValue({ id: 100, userId: 1 }),
    },
    cartItem: {
      findUnique: jest.fn().mockResolvedValue(pick(opts.existingItem, null)),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

function makeService(prisma: any) {
  const settings = {} as any;
  const config = {} as any;
  const service = new CartService(prisma, settings, config);
  jest.spyOn(service, 'getCart').mockResolvedValue({ items: [] } as any);
  return service;
}

describe('CartService.addItem', () => {
  it('rejects unavailable/inactive variants and products', async () => {
    const inactiveVariant = makePrisma({
      variant: { id: 11, isActive: false, stock: 5, product: { isActive: true } },
    });
    await expect(makeService(inactiveVariant).addItem(1, 11, 1)).rejects.toMatchObject({
      code: 'VARIANT_UNAVAILABLE',
    });

    const inactiveProduct = makePrisma({
      variant: { id: 11, isActive: true, stock: 5, product: { isActive: false } },
    });
    await expect(makeService(inactiveProduct).addItem(1, 11, 1)).rejects.toMatchObject({
      code: 'VARIANT_UNAVAILABLE',
    });

    const missing = makePrisma({ variant: null });
    await expect(makeService(missing).addItem(1, 11, 1)).rejects.toMatchObject({
      code: 'VARIANT_UNAVAILABLE',
    });
  });

  it('rejects quantities above available stock', async () => {
    const prisma = makePrisma({ variant: { id: 11, isActive: true, stock: 2, product: { isActive: true } } });
    await expect(makeService(prisma).addItem(1, 11, 3)).rejects.toMatchObject({
      code: 'OUT_OF_STOCK',
    });
  });

  it('enforces MAX_CART_ITEM_QTY on new items and on merges', async () => {
    const prisma = makePrisma({
      variant: { id: 11, isActive: true, stock: 500, product: { isActive: true } },
    });
    await expect(makeService(prisma).addItem(1, 11, MAX_CART_ITEM_QTY + 1)).rejects.toMatchObject({
      code: 'LIMIT_REACHED',
    });

    const merged = makePrisma({
      variant: { id: 11, isActive: true, stock: 500, product: { isActive: true } },
      existingItem: { id: 5, quantity: MAX_CART_ITEM_QTY - 1, variantId: 11 },
    });
    await expect(makeService(merged).addItem(1, 11, 2)).rejects.toMatchObject({
      code: 'LIMIT_REACHED',
    });
  });

  it('merges quantities into an existing line item', async () => {
    const prisma = makePrisma({ existingItem: { id: 5, quantity: 3, variantId: 11 } });
    await makeService(prisma).addItem(1, 11, 2);
    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { quantity: 5 },
    });
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });

  it('creates the cart lazily on first add', async () => {
    const prisma = makePrisma({ cart: null });
    await makeService(prisma).addItem(1, 11, 1);
    expect(prisma.cart.create).toHaveBeenCalledWith({ data: { userId: 1 } });
    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: { cartId: 100, variantId: 11, quantity: 1 },
    });
  });
});
