// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requestData } from '../api/client';
import { useAuth } from '../auth/auth-provider';
import type { CartView, ProductDetail } from '../api/types';
import { ApiError } from '../lib/errors';
import { addGuestCartItem, readGuestCart, readGuestTransfer } from '../features/cart/guest-cart';
import { GuestCartPage } from '../pages/GuestCartPage';
import { GuestCartTransfer, GuestCartTransferGate } from './GuestCartTransfer';
import { queryKeys } from '../api/query-keys';
import { createGuestCartTestLocks } from '../features/cart/guest-cart.test-locks';
vi.mock('../api/client', () => ({ requestData: vi.fn() }));
vi.mock('../auth/auth-provider', () => ({ useAuth: vi.fn() }));
const product = {
  id: 1,
  name: 'غذای گربه',
  slug: 'cat-food',
  isActive: true,
  images: [],
  variants: [{ id: 11, weightGram: 500, price: 1000, inStock: true }],
} as unknown as ProductDetail;
const serverCart = (): CartView => ({
  items: [
    {
      id: 101,
      variantId: 11,
      quantity: 1,
      productName: product.name,
      productSlug: product.slug,
      productImage: null,
      weightGram: 500,
      unitPrice: 2300,
      total: 2300,
      available: true,
    },
  ],
  itemsTotal: 2300,
});
let host: HTMLDivElement, root: Root, client: QueryClient;
let actor = 7;
const api = vi.mocked(requestData);
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
async function render() {
  vi.mocked(useAuth).mockReturnValue({ status: 'authed', user: { id: actor } } as ReturnType<
    typeof useAuth
  >);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <GuestCartTransfer />
          <GuestCartPage transferring actorId={actor} />
          <GuestCartTransferGate>
            <div data-checkout>Checkout</div>
          </GuestCartTransferGate>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  await flush();
}
function button(label: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (node) => node.textContent?.trim() === label,
  )!;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('navigator', { locks: createGuestCartTestLocks() });
  localStorage.clear();
  readGuestCart();
  vi.resetAllMocks();
  actor = 7;
  addGuestCartItem(product, product.variants[0]!, 2);
  host = document.createElement('div');
  host.id = 'root';
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  localStorage.clear();
  readGuestCart();
  vi.unstubAllGlobals();
});
it('keeps checkout blocked on stock rejection, permits reducing the definite failed row, and publishes current server prices before unblocking', async () => {
  let applied = false;
  api.mockImplementation(async (path, options) => {
    expect(readGuestTransfer()?.actorId).toBe(7);
    if (path === '/cart/items') {
      const count = (options?.body as { quantity: number }).quantity;
      if (count > 1)
        throw new ApiError({
          success: false,
          statusCode: 400,
          code: 'OUT_OF_STOCK',
          message: 'موجودی کافی نیست.',
        });
      applied = true;
    }
    return applied ? serverCart() : { items: [], itemsTotal: 0 };
  });
  await render();
  expect(host.querySelector('[data-checkout]')).toBeNull();
  expect(readGuestTransfer()?.rows[0]?.phase).toBe('ready');
  const quantity = host.querySelector<HTMLInputElement>('#guest-qty-11')!;
  expect(quantity.disabled).toBe(false);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(quantity, '1');
    quantity.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => button('به‌روزرسانی تعداد').click());
  expect(readGuestCart()[0]?.quantity).toBe(1);
  expect(readGuestTransfer()?.rows[0]?.quantity).toBe(1);
  await act(async () => button('بررسی دوبارهٔ انتقال').click());
  await flush();
  expect(readGuestCart()).toHaveLength(0);
  expect(host.querySelector('[data-checkout]')).not.toBeNull();
  expect(client.getQueryData<CartView>(queryKeys.cart)?.items[0]?.unitPrice).toBe(2300);
  expect(
    api.mock.calls
      .filter(([path]) => path === '/cart/items')
      .map(([, options]) => (options?.body as { quantity: number }).quantity),
  ).toEqual([2, 1]);
});
it('allows removing a definitely rejected row without ever repeating a write or leaving a permanent checkout lock', async () => {
  api.mockImplementation(async (path) => {
    if (path === '/cart/items')
      throw new ApiError({
        success: false,
        statusCode: 400,
        code: 'VARIANT_UNAVAILABLE',
        message: 'ناموجود',
      });
    return { items: [], itemsTotal: 0 };
  });
  await render();
  expect(button('حذف').disabled).toBe(false);
  await act(async () => button('حذف').click());
  await flush();
  expect(readGuestTransfer()).toBeNull();
  expect(readGuestCart()).toHaveLength(0);
  expect(host.querySelector('[data-checkout]')).not.toBeNull();
  expect(api.mock.calls.filter(([path]) => path === '/cart/items')).toHaveLength(1);
});
it('offers an explicit named retry after an ambiguous absent POST, preserves it on cancellation and adds only after confirmation', async () => {
  let posts = 0,
    applied = false;
  api.mockImplementation(async (path) => {
    if (path === '/cart/items') {
      if (++posts === 1) throw new TypeError('ارتباط قطع شد.');
      applied = true;
    }
    return applied
      ? {
          ...serverCart(),
          items: [{ ...serverCart().items[0]!, quantity: 2, total: 4600 }],
          itemsTotal: 4600,
        }
      : { items: [], itemsTotal: 0 };
  });
  await render();
  expect(posts).toBe(1);
  expect(readGuestTransfer()?.rows[0]?.phase).toBe('uncertain');
  expect(host.querySelector<HTMLInputElement>('#guest-qty-11')?.disabled).toBe(true);
  await act(async () => button('بررسی دوبارهٔ انتقال').click());
  await flush();
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('غذای گربه');
  await act(async () =>
    [...dialog.querySelectorAll('button')].find((node) => node.textContent === 'انصراف')!.click(),
  );
  await flush();
  expect(posts).toBe(1);
  expect(readGuestTransfer()?.rows[0]?.phase).toBe('uncertain');
  expect(host.querySelector('[data-checkout]')).toBeNull();
  await act(async () => button('بررسی دوبارهٔ انتقال').click());
  await flush();
  await act(async () =>
    [...document.querySelector('[role="dialog"]')!.querySelectorAll('button')]
      .find((node) => node.textContent === 'بررسی و افزودن دوباره')!
      .click(),
  );
  await flush();
  expect(posts).toBe(2);
  expect(readGuestCart()).toHaveLength(0);
  expect(host.querySelector('[data-checkout]')).not.toBeNull();
});
it('finishes an old actor flight before giving the next actor a visible recoverable mismatch, and resumes only the original actor', async () => {
  let finish!: (value: CartView) => void;
  let readCount = 0,
    applied = false;
  api.mockImplementation(async (path) => {
    if (path === '/cart' && ++readCount === 1)
      return new Promise<CartView>((resolve) => {
        finish = resolve;
      });
    if (path === '/cart/items') applied = true;
    return applied
      ? {
          ...serverCart(),
          items: [{ ...serverCart().items[0]!, quantity: 2, total: 4600 }],
          itemsTotal: 4600,
        }
      : { items: [], itemsTotal: 0 };
  });
  await render();
  actor = 8;
  await render();
  await act(async () => finish({ items: [], itemsTotal: 0 }));
  await flush();
  expect(host.textContent).toContain('حساب دیگری');
  expect(button('بررسی دوبارهٔ انتقال')).toBeDefined();
  expect(readGuestTransfer()?.actorId).toBe(7);
  expect(readCount).toBe(1);
  actor = 7;
  await render();
  expect(readGuestCart()).toHaveLength(0);
  expect(api.mock.calls.filter(([path]) => path === '/cart/items')).toHaveLength(1);
});
