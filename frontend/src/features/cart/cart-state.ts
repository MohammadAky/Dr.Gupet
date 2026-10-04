import type { CartView } from '../../api/types';
import { shippingEstimate as fallbackShippingEstimate } from '../../lib/constants';

/** Invalidate a coupon whenever the server cart's financial or stock state changes. */
export function cartFingerprint(cart?: CartView): string {
  if (!cart) return 'unavailable';
  const items = [...cart.items]
    .sort((a, b) => a.id - b.id)
    .map((item) => [
      item.id,
      item.variantId,
      item.quantity,
      item.unitPrice,
      item.total,
      item.available,
      item.stockProblem ?? null,
    ]);
  return JSON.stringify([
    items,
    cart.itemsTotal,
    cart.estimate?.shippingCost ?? null,
    cart.estimate?.freeShippingThreshold ?? null,
  ]);
}

/** Server estimates take precedence; the fallback is only a labelled UI estimate. */
export function shippingEstimate(cart?: CartView): { cost: number; source: 'server' | 'fallback' } {
  const cost = cart?.estimate?.shippingCost;
  if (typeof cost === 'number' && Number.isSafeInteger(cost) && cost >= 0) {
    return { cost, source: 'server' };
  }
  return { cost: fallbackShippingEstimate(cart?.itemsTotal ?? 0), source: 'fallback' };
}
