// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CartItemView, CartView, ProductDetail } from '../../api/types';
import { ApiError } from '../../lib/errors';
import {
  addGuestCartItem,
  beginGuestTransfer,
  editGuestTransferItem,
  GUEST_CART_KEY,
  readGuestCart,
  readGuestTransfer,
  setGuestCartQuantity,
} from './guest-cart';
import { transferGuestCart, type GuestTransferApi } from './guest-cart-transfer';
import { createGuestCartTestLocks } from './guest-cart.test-locks';
const product: ProductDetail = {
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
  images: [],
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
const item = (variantId: number, quantity: number): CartItemView => ({
  id: variantId + 100,
  variantId,
  quantity,
  productName: 'غذا',
  productSlug: 'food',
  productImage: null,
  weightGram: 500,
  unitPrice: 1200,
  total: 1200 * quantity,
  available: true,
});
function transport(initial: CartItemView[] = []) {
  let rows = [...initial];
  const view = (): CartView => ({
    items: rows.map((row) => ({ ...row })),
    itemsTotal: rows.reduce((sum, row) => sum + row.total, 0),
  });
  const api = {
    read: vi.fn(async () => view()),
    add: vi.fn(async (id: number, quantity: number) => {
      rows.push(item(id, quantity));
      return view();
    }),
    set: vi.fn(async (id: number, quantity: number) => {
      rows = rows.map((row) =>
        row.id === id ? { ...row, quantity, total: row.unitPrice * quantity } : row,
      );
      return view();
    }),
  };
  return { api, view };
}
beforeEach(() => {
  localStorage.clear();
  readGuestCart();
  vi.stubGlobal('navigator', {
    locks: createGuestCartTestLocks(),
  });
  addGuestCartItem(product, product.variants[0]!, 2);
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  readGuestCart();
});
it('replaces an overlapping quantity absolutely, keeps server-only items and clears the draft only after verification', async () => {
  const h = transport([item(11, 5), item(12, 3)]);
  h.api.read.mockImplementation(async () => {
    expect(readGuestTransfer()?.actorId).toBe(7);
    return h.view();
  });
  const result = await transferGuestCart(7, h.api, () => true);
  expect(h.api.add).not.toHaveBeenCalled();
  expect(h.api.set).toHaveBeenCalledExactlyOnceWith(111, 2);
  expect(result?.items.map((row) => [row.variantId, row.quantity])).toEqual([
    [11, 2],
    [12, 3],
  ]);
  expect(readGuestCart()).toHaveLength(0);
  expect(readGuestTransfer()).toBeNull();
});
it('single-flights two callers and adds a missing variant once', async () => {
  const h = transport();
  await Promise.all([
    transferGuestCart(7, h.api, () => true),
    transferGuestCart(7, h.api, () => true),
  ]);
  expect(h.api.add).toHaveBeenCalledExactlyOnceWith(11, 2);
  expect(h.api.set).not.toHaveBeenCalled();
});
it('reconciles a response-lost POST by reading and setting the existing item, never adding again', async () => {
  const h = transport();
  const add = h.api.add.getMockImplementation()!;
  h.api.add.mockImplementationOnce(async (id, quantity) => {
    await add(id, quantity);
    throw new TypeError('network response lost');
  });
  await transferGuestCart(7, h.api, () => true);
  expect(h.api.add).toHaveBeenCalledOnce();
  expect(h.view().items[0]?.quantity).toBe(2);
  expect(readGuestCart()).toHaveLength(0);
});
it('keeps an absent uncertain POST checkpoint across retry and never blindly repeats the addition', async () => {
  const h = transport();
  h.api.add.mockRejectedValue(new TypeError('offline'));
  await expect(transferGuestCart(7, h.api, () => true)).rejects.toThrow('offline');
  expect(readGuestTransfer()?.rows[0]?.phase).toBe('uncertain');
  expect(readGuestCart()).toHaveLength(1);
  await expect(transferGuestCart(7, h.api, () => true)).rejects.toThrow('افزودن دوباره');
  expect(h.api.add).toHaveBeenCalledOnce();
});
it('permits a safe retry after a definite rejected write and keeps the guest draft intact meanwhile', async () => {
  const h = transport();
  h.api.add.mockRejectedValueOnce(
    new ApiError({ success: false, statusCode: 400, code: 'OUT_OF_STOCK', message: 'ناموجود' }),
  );
  await expect(transferGuestCart(7, h.api, () => true)).rejects.toThrow('ناموجود');
  expect(readGuestTransfer()?.rows[0]?.phase).toBe('ready');
  await transferGuestCart(7, h.api, () => true);
  expect(h.api.add).toHaveBeenCalledTimes(2);
  expect(readGuestCart()).toHaveLength(0);
});
it('requires explicit confirmation for a missing ambiguous addition and reconciles again after confirmation', async () => {
  const h = transport();
  h.api.add.mockRejectedValueOnce(new TypeError('offline'));
  await expect(transferGuestCart(7, h.api, () => true)).rejects.toThrow('offline');
  const cancel = vi.fn(async () => false);
  await expect(transferGuestCart(7, h.api, () => true, undefined, cancel)).rejects.toThrow(
    'تأیید شما',
  );
  expect(cancel).toHaveBeenCalledExactlyOnceWith(11);
  expect(h.api.add).toHaveBeenCalledOnce();
  const confirm = vi.fn(async () => {
    // The delayed original request becomes visible while the dialog is open.
    await h.api.add.getMockImplementation()!(11, 5);
    return true;
  });
  await transferGuestCart(7, h.api, () => true, undefined, confirm);
  expect(h.api.add).toHaveBeenCalledOnce();
  expect(h.api.set).toHaveBeenCalledExactlyOnceWith(111, 2);
  expect(readGuestCart()).toHaveLength(0);
});
it('keeps ambiguous absolute writes protected until a fresh read and absolute retry resolves them', async () => {
  const h = transport([item(11, 5)]);
  h.api.set.mockRejectedValueOnce(new TypeError('response lost'));
  await expect(transferGuestCart(7, h.api, () => true)).rejects.toThrow('response lost');
  expect(readGuestTransfer()?.rows[0]?.phase).toBe('uncertain');
  await transferGuestCart(7, h.api, () => true);
  expect(h.api.add).not.toHaveBeenCalled();
  expect(h.view().items[0]?.quantity).toBe(2);
});
it('stops after an identity change, preserves its original actor checkpoint and never writes into the next account', async () => {
  let current = true;
  const h = transport();
  const add = h.api.add.getMockImplementation()!;
  h.api.add.mockImplementationOnce(async (id, quantity) => {
    const result = await add(id, quantity);
    current = false;
    return result;
  });
  await expect(transferGuestCart(7, h.api, () => current)).rejects.toThrow('نشست');
  expect(readGuestCart()).toHaveLength(1);
  const other = transport();
  await expect(transferGuestCart(8, other.api, () => true)).rejects.toThrow('حساب دیگری');
  expect(other.api.read).not.toHaveBeenCalled();
  expect(other.api.add).not.toHaveBeenCalled();
  await transferGuestCart(7, h.api, () => true);
  expect(h.api.add).toHaveBeenCalledOnce();
  expect(readGuestCart()).toHaveLength(0);
});
it('does not dispatch any request when the actor is inactive or cross-tab exclusion is unsupported', async () => {
  const h = transport();
  await expect(transferGuestCart(7, h.api, () => false)).rejects.toThrow('نشست');
  expect(h.api.read).not.toHaveBeenCalled();
  vi.stubGlobal('navigator', {});
  await expect(transferGuestCart(7, h.api as GuestTransferApi, () => true)).rejects.toThrow(
    'مرورگر',
  );
  expect(h.api.add).not.toHaveBeenCalled();
  expect(readGuestCart()).toHaveLength(1);
});
it('rejects a stale failed-tab recovery edit while another tab resumes the same checkpoint under the transfer lock', async () => {
  setGuestCartQuantity(11, 5);
  beginGuestTransfer(7);
  const h = transport();
  let release!: (cart: CartView) => void;
  let started!: () => void;
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  h.api.read.mockImplementationOnce(
    () =>
      new Promise<CartView>((resolve) => {
        release = resolve;
        started();
      }),
  );
  const transfer = transferGuestCart(7, h.api, () => true);
  await reading;
  await expect(editGuestTransferItem(7, 11, 1)).rejects.toThrow('تب دیگری');
  expect(readGuestCart()[0]?.quantity).toBe(5);
  expect(readGuestTransfer()?.rows[0]?.quantity).toBe(5);
  release({ items: [], itemsTotal: 0 });
  await transfer;
  expect(h.api.add).toHaveBeenCalledExactlyOnceWith(11, 5);
  expect(readGuestCart()).toHaveLength(0);
});
it('does not write or clear a newly accepted target if storage changed during the cart read', async () => {
  setGuestCartQuantity(11, 5);
  beginGuestTransfer(7);
  const h = transport();
  let release!: (cart: CartView) => void;
  let started!: () => void;
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  h.api.read.mockImplementationOnce(
    () =>
      new Promise<CartView>((resolve) => {
        release = resolve;
        started();
      }),
  );
  const transfer = transferGuestCart(7, h.api, () => true);
  await reading;
  // Model a restored/older tab writing a valid draft without observing the lock.
  const draft = JSON.parse(localStorage.getItem(GUEST_CART_KEY)!);
  draft.items[0].quantity = 1;
  draft.transfer.rows[0].quantity = 1;
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(draft));
  release({ items: [], itemsTotal: 0 });
  await expect(transfer).rejects.toThrow('تب دیگری تغییر');
  expect(h.api.add).not.toHaveBeenCalled();
  expect(h.api.set).not.toHaveBeenCalled();
  expect(readGuestCart()[0]?.quantity).toBe(1);
  expect(readGuestTransfer()?.rows[0]?.phase).toBe('ready');
  await transferGuestCart(7, h.api, () => true);
  expect(h.api.add).toHaveBeenCalledExactlyOnceWith(11, 1);
  expect(readGuestCart()).toHaveLength(0);
});
