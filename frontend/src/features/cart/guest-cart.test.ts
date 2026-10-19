// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ProductDetail } from '../../api/types';
import { API_BASE_URL } from '../../lib/env';
import { createGuestCartTestLocks } from './guest-cart.test-locks';
import {
  GUEST_CART_KEY,
  addGuestCartItem,
  beginGuestTransfer,
  clearGuestCart,
  editGuestTransferItem,
  readGuestCart,
  readGuestTransfer,
  setGuestCartQuantity,
  setGuestTransferPhase,
  subscribeGuestCart,
} from './guest-cart';

export const product: ProductDetail = {
  id: 1,
  slug: 'food',
  name: 'غذا',
  brand: { id: 1, name: 'برند', slug: 'brand' },
  category: { id: 1, name: 'غذا', slug: 'food' },
  petType: { id: 1, name: 'گربه', slug: 'cat' },
  description: null,
  ingredientsText: null,
  lifeStage: 'ADULT',
  sizeClass: 'ALL',
  neuterSuitability: 'ANY',
  images: [{ id: 1, url: '/uploads/food.webp', sortOrder: 0 }],
  variants: [
    {
      id: 11,
      sku: 'F1',
      weightGram: 500,
      price: 1000,
      compareAtPrice: null,
      inStock: true,
      lowStock: false,
    },
  ],
  tags: [],
  isActive: true,
  createdAt: '',
  updatedAt: '',
};
beforeEach(() => {
  vi.stubGlobal('navigator', { locks: createGuestCartTestLocks() });
  localStorage.clear();
  readGuestCart();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  readGuestCart();
});
it('durably saves only public display metadata, accepts cumulative twenty and never stores a discount or private profile', () => {
  addGuestCartItem(product, product.variants[0]!, 19);
  addGuestCartItem(product, product.variants[0]!, 1);
  expect(readGuestCart()[0]?.quantity).toBe(20);
  expect(() => addGuestCartItem(product, product.variants[0]!, 1)).toThrow('۲۰');
  const persisted = JSON.parse(localStorage.getItem(GUEST_CART_KEY)!);
  expect(Object.keys(persisted.items[0]).sort()).toEqual(
    [
      'productId',
      'productImage',
      'productName',
      'productSlug',
      'quantity',
      'unitPrice',
      'variantId',
      'weightGram',
    ].sort(),
  );
  expect(persisted.transfer).toBeNull();
  expect(readGuestCart()).toBe(readGuestCart());
});
it.each([0, 21, 1.5, NaN])('rejects invalid guest quantity %s without a write', (quantity) => {
  expect(() => addGuestCartItem(product, product.variants[0]!, quantity)).toThrow();
  expect(readGuestCart()).toHaveLength(0);
});
it('uses the actual detailed variant, rejects sample/unavailable/unrelated variants and untrusted persisted data', () => {
  expect(() => addGuestCartItem({ ...product, isSample: true }, product.variants[0]!, 1)).toThrow();
  expect(() =>
    addGuestCartItem(
      { ...product, variants: [{ ...product.variants[0]!, inStock: false }] },
      product.variants[0]!,
      1,
    ),
  ).toThrow();
  expect(() => addGuestCartItem(product, { ...product.variants[0]!, id: 999 }, 1)).toThrow();
  localStorage.setItem(GUEST_CART_KEY, '{broken');
  expect(readGuestCart()).toHaveLength(0);
  localStorage.setItem(
    GUEST_CART_KEY,
    JSON.stringify({ version: 1, items: [{ variantId: 1, quantity: 900 }] }),
  );
  expect(readGuestCart()).toHaveLength(0);
});
it('does not report success or change the snapshot when browser persistence fails', () => {
  const original = readGuestCart();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Denied', 'SecurityError');
  });
  expect(() => addGuestCartItem(product, product.variants[0]!, 1)).toThrow('ذخیره');
  expect(readGuestCart()).toBe(original);
});
it('notifies same-tab subscribers and re-reads storage changes from another tab', () => {
  const changed = vi.fn();
  const stop = subscribeGuestCart(changed);
  addGuestCartItem(product, product.variants[0]!, 2);
  expect(changed).toHaveBeenCalledOnce();
  localStorage.removeItem(GUEST_CART_KEY);
  window.dispatchEvent(new StorageEvent('storage', { key: GUEST_CART_KEY }));
  expect(changed).toHaveBeenCalledTimes(2);
  expect(readGuestCart()).toHaveLength(0);
  stop();
});
it('preserves absolute first-party uploaded images as relative paths without saving origins', () => {
  const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
  addGuestCartItem(
    { ...product, images: [{ id: 1, sortOrder: 0, url: `${apiOrigin}/uploads/4fa3b818.webp` }] },
    product.variants[0]!,
    1,
  );
  expect(readGuestCart()[0]?.productImage).toBe('/uploads/4fa3b818.webp');
  const persisted = JSON.parse(localStorage.getItem(GUEST_CART_KEY)!);
  expect(persisted.items[0].productImage).toBe('/uploads/4fa3b818.webp');
});
it.each([
  'https://foreign.example/uploads/food.webp',
  '//foreign.example/uploads/food.webp',
  `${window.location.origin}/uploads/food.webp?tracking=1`,
  `${window.location.origin}/uploads/food.webp#fragment`,
  `${window.location.origin}/uploads/../uploads/food.webp`,
  `${window.location.origin}/uploads/%2e%2e/uploads/food.webp`,
  `${window.location.origin.replace('://', '://user:password@')}/uploads/food.webp`,
])('drops unsafe or foreign image URLs while retaining a valid guest item: %s', (url) => {
  addGuestCartItem({ ...product, images: [{ id: 1, sortOrder: 0, url }] }, product.variants[0]!, 1);
  expect(readGuestCart()).toHaveLength(1);
  expect(readGuestCart()[0]?.productImage).toBeNull();
});
it('persists an actor-bound immutable target before transfer and prevents guest edits or another actor claiming it', () => {
  addGuestCartItem(product, product.variants[0]!, 3);
  const checkpoint = beginGuestTransfer(7)!;
  expect(checkpoint.rows).toEqual([{ variantId: 11, quantity: 3, phase: 'ready' }]);
  expect(readGuestTransfer()?.actorId).toBe(7);
  expect(beginGuestTransfer(7)?.id).toBe(checkpoint.id);
  expect(() => beginGuestTransfer(8)).toThrow('حساب دیگری');
  expect(() => setGuestCartQuantity(11, 2)).toThrow('انتقال');
  expect(() => clearGuestCart()).toThrow('انتقال');
});
it('allows only the checkpoint actor to reduce or remove a definitely ready row and persists both target and display together', async () => {
  addGuestCartItem(product, product.variants[0]!, 3);
  const checkpoint = beginGuestTransfer(7)!;
  await expect(editGuestTransferItem(8, 11, 1)).rejects.toThrow();
  setGuestTransferPhase(checkpoint.id, 7, 11, 'uncertain');
  await expect(editGuestTransferItem(7, 11, null)).rejects.toThrow();
  setGuestTransferPhase(checkpoint.id, 7, 11, 'ready');
  await editGuestTransferItem(7, 11, 1);
  expect(readGuestTransfer()?.rows[0]?.quantity).toBe(1);
  expect(readGuestCart()[0]?.quantity).toBe(1);
  await editGuestTransferItem(7, 11, null);
  expect(readGuestCart()).toHaveLength(0);
  expect(readGuestTransfer()).toBeNull();
});
