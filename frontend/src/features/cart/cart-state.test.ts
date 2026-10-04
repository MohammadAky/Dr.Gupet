import { describe, expect, it } from 'vitest';
import type { CartView } from '../../api/types';
import { cartFingerprint, shippingEstimate } from './cart-state';

const cart: CartView = {
  items: [
    {
      id: 1,
      variantId: 9,
      productName: 'غذا',
      productSlug: 'food',
      productImage: null,
      weightGram: 1000,
      unitPrice: 200_000,
      quantity: 2,
      total: 400_000,
      available: true,
    },
  ],
  itemsTotal: 400_000,
};

describe('server cart financial state', () => {
  it('honours zero or changed server shipping instead of local defaults', () => {
    const withCost = (shippingCost: number): CartView => ({
      ...cart,
      estimate: {
        itemsTotal: cart.itemsTotal,
        shippingCost,
        freeShippingThreshold: 900_000,
        note: '',
      },
    });
    expect(shippingEstimate(withCost(0))).toEqual({ cost: 0, source: 'server' });
    expect(shippingEstimate(withCost(85_000))).toEqual({ cost: 85_000, source: 'server' });
    for (const invalid of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(shippingEstimate(withCost(invalid))).toEqual({ cost: 50_000, source: 'fallback' });
    }
    expect(shippingEstimate({ ...cart, itemsTotal: 1_500_000 })).toEqual({
      cost: 0,
      source: 'fallback',
    });
  });

  it('invalidates financial or availability changes but not cosmetic text or ordering', () => {
    const item = cart.items[0]!;
    const original = cartFingerprint(cart);
    expect(cartFingerprint({ ...cart, items: [{ ...item, productName: 'نام تازه' }] })).toBe(
      original,
    );
    for (const change of [
      { quantity: 3 },
      { unitPrice: 210_000 },
      { total: 420_000 },
      { available: false },
      { stockProblem: 'OUT_OF_STOCK' as const },
    ]) {
      expect(cartFingerprint({ ...cart, items: [{ ...item, ...change }] })).not.toBe(original);
    }
    const second = { ...item, id: 2, variantId: 10 };
    expect(cartFingerprint({ ...cart, items: [item, second] })).toBe(
      cartFingerprint({ ...cart, items: [second, item] }),
    );
    expect(cartFingerprint()).not.toBe(cartFingerprint({ items: [], itemsTotal: 0 }));
  });
});
