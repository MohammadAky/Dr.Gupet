// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { CartView } from '../api/types';
import { useAuth } from '../auth/auth-provider';
import { CartPage } from './CartPage';

vi.mock('../api/endpoints-shop', () => ({ shopApi: {
  cart: vi.fn(), updateCartItem: vi.fn(), removeCartItem: vi.fn(), clearCart: vi.fn(), validateCoupon: vi.fn(),
} }));
vi.mock('../auth/auth-provider', () => ({ useAuth: vi.fn() }));

const initialCart: CartView = {
  items: [{ id: 1, variantId: 11, productName: 'غذای گربه', productSlug: 'cat-food',
    productImage: null, weightGram: 1000, unitPrice: 100000, quantity: 1, total: 100000, available: true }],
  itemsTotal: 100000,
  estimate: { itemsTotal: 100000, shippingCost: 50000, freeShippingThreshold: 1500000, note: 'تخمین سرور' },
};
const changedCart: CartView = {
  ...initialCart,
  items: [{ ...initialCart.items[0]!, quantity: 2, total: 200000 }],
  itemsTotal: 200000,
  estimate: { ...initialCart.estimate!, itemsTotal: 200000 },
};
const userA = { id: 7 };

function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll('button'))
    .find((node) => node.textContent?.trim() === label);
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

async function changeInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('cart coupon and write consistency', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.resetAllMocks();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(useAuth).mockReturnValue({ status: 'authed', user: userA } as ReturnType<typeof useAuth>);
    vi.mocked(shopApi.cart).mockResolvedValue(initialCart);
    vi.mocked(shopApi.validateCoupon).mockResolvedValue({ code: 'SAVE', discountAmount: 10000, finalAmount: 90000 });
    vi.mocked(shopApi.updateCartItem).mockResolvedValue(changedCart);
    vi.mocked(shopApi.removeCartItem).mockResolvedValue(initialCart);
    vi.mocked(shopApi.clearCart).mockResolvedValue({ items: [], itemsTotal: 0 });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
  });

  async function renderCart() {
    await act(async () => root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/cart']}><CartPage /><CurrentPath /></MemoryRouter>
      </QueryClientProvider>,
    ));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }

  async function submitCoupon(code: string) {
    await changeInput(container.querySelector<HTMLInputElement>('#coupon')!, code);
    await act(async () => button(container, 'اعمال کد').click());
  }

  it('never calls cart API for a guest', async () => {
    vi.mocked(useAuth).mockReturnValue({ status: 'guest', user: null } as ReturnType<typeof useAuth>);
    await renderCart();
    expect(shopApi.cart).not.toHaveBeenCalled();
    expect(shopApi.validateCoupon).not.toHaveBeenCalled();
    expect(container.textContent).toContain('برای مشاهدهٔ سبد خرید');
  });

  it('discards a late coupon success after editing the code', async () => {
    let resolveCoupon!: (value: { code: string; discountAmount: number; finalAmount: number }) => void;
    vi.mocked(shopApi.validateCoupon).mockReturnValue(new Promise((resolve) => { resolveCoupon = resolve; }));
    await renderCart();
    await submitCoupon('SAVE');
    await changeInput(container.querySelector<HTMLInputElement>('#coupon')!, 'OTHER');
    await act(async () => resolveCoupon({ code: 'SAVE', discountAmount: 10000, finalAmount: 90000 }));
    expect(container.textContent).not.toContain('تخفیف SAVE:');
    expect(button(container, 'اعمال کد').disabled).toBe(false);
  });

  it('reports the current coupon failure but ignores a failure from an edited code', async () => {
    vi.mocked(shopApi.validateCoupon).mockRejectedValueOnce(new Error('کد تخفیف معتبر نیست'));
    await renderCart();
    await submitCoupon('BAD');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('کد تخفیف معتبر نیست');
    expect(button(container, 'اعمال کد').disabled).toBe(false);

    let rejectOlder!: (error: Error) => void;
    vi.mocked(shopApi.validateCoupon).mockReturnValue(new Promise((_, reject) => { rejectOlder = reject; }));
    await submitCoupon('SAVE');
    await changeInput(container.querySelector<HTMLInputElement>('#coupon')!, 'OTHER');
    await act(async () => rejectOlder(new Error('خطای کد قبلی')));
    expect(container.textContent).not.toContain('خطای کد قبلی');
  });

  it('clears accepted coupon on a changed cart snapshot and ignores an older response', async () => {
    await renderCart();
    await submitCoupon('SAVE');
    expect(container.textContent).toContain('تخفیف SAVE:');
    await act(async () => {
      client.setQueryData(queryKeys.cart, changedCart);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).not.toContain('تخفیف SAVE:');

    let resolveCoupon!: (value: { code: string; discountAmount: number; finalAmount: number }) => void;
    vi.mocked(shopApi.validateCoupon).mockReturnValue(new Promise((resolve) => { resolveCoupon = resolve; }));
    await submitCoupon('SAVE');
    await act(async () => {
      client.setQueryData(queryKeys.cart, initialCart);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => resolveCoupon({ code: 'SAVE', discountAmount: 10000, finalAmount: 90000 }));
    expect(container.textContent).not.toContain('تخفیف SAVE:');
  });

  it('rejects fractional quantities and blocks other writes and checkout until the server cart reloads', async () => {
    let resolveWrite!: (value: CartView) => void;
    vi.mocked(shopApi.updateCartItem).mockReturnValue(new Promise((resolve) => { resolveWrite = resolve; }));
    vi.mocked(shopApi.cart).mockResolvedValueOnce(initialCart).mockResolvedValue(changedCart);
    await renderCart();
    await submitCoupon('SAVE');
    const quantity = container.querySelector<HTMLInputElement>('input[type="number"]')!;
    await changeInput(quantity, '1.5');
    expect(shopApi.updateCartItem).not.toHaveBeenCalled();

    await changeInput(quantity, '2');
    expect(shopApi.updateCartItem).toHaveBeenCalledWith(1, 2);
    expect(container.textContent).not.toContain('تخفیف SAVE:');
    expect(button(container, 'تکمیل خرید').disabled).toBe(true);
    expect(button(container, 'خالی‌کردن سبد').disabled).toBe(true);
    await act(async () => button(container, 'خالی‌کردن سبد').click());
    expect(shopApi.clearCart).not.toHaveBeenCalled();

    await act(async () => resolveWrite(changedCart));
    expect(button(container, 'تکمیل خرید').disabled).toBe(false);
    expect(container.textContent).toContain('۲۰۰');
  });

  it('shows a failed cart write and unlocks controls without restoring a stale discount', async () => {
    vi.mocked(shopApi.removeCartItem).mockRejectedValue(new Error('حذف ناموفق بود'));
    await renderCart();
    await submitCoupon('SAVE');
    await act(async () => button(container, 'حذف').click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('حذف ناموفق بود');
    expect(container.textContent).not.toContain('تخفیف SAVE:');
    expect(button(container, 'تکمیل خرید').disabled).toBe(false);
  });

  it('explains why checkout is blocked for an unavailable item without a stock code', async () => {
    vi.mocked(shopApi.cart).mockResolvedValue({
      ...initialCart,
      items: [{ ...initialCart.items[0]!, available: false }],
    });
    await renderCart();
    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain('این کالا در حال حاضر قابل خرید نیست.');
    expect(button(container, 'تکمیل خرید').disabled).toBe(true);
  });

  it('drops late coupon and cart-write results after logout or a new account session', async () => {
    let resolveCoupon!: (value: { code: string; discountAmount: number; finalAmount: number }) => void;
    let rejectWrite!: (error: Error) => void;
    vi.mocked(shopApi.validateCoupon).mockReturnValue(new Promise((resolve) => { resolveCoupon = resolve; }));
    vi.mocked(shopApi.updateCartItem).mockReturnValue(new Promise((_, reject) => { rejectWrite = reject; }));
    await renderCart();
    await submitCoupon('SAVE');
    await changeInput(container.querySelector<HTMLInputElement>('input[type="number"]')!, '2');
    expect(shopApi.updateCartItem).toHaveBeenCalledWith(1, 2);

    vi.mocked(useAuth).mockReturnValue({ status: 'guest', user: null } as ReturnType<typeof useAuth>);
    await act(async () => { client.clear(); });
    await renderCart();
    vi.mocked(useAuth).mockReturnValue({ status: 'authed', user: { id: 8 } } as ReturnType<typeof useAuth>);
    await renderCart();
    await act(async () => {
      resolveCoupon({ code: 'SAVE', discountAmount: 10000, finalAmount: 90000 });
      rejectWrite(new Error('خطای حساب قبلی'));
    });
    expect(container.textContent).not.toContain('تخفیف SAVE:');
    expect(container.textContent).not.toContain('خطای حساب قبلی');
    expect(button(container, 'تکمیل خرید').disabled).toBe(false);
  });
});
