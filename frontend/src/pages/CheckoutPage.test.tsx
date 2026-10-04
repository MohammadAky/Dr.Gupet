// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { Address, CartView, CouponPreview } from '../api/types';
import { clearPendingOrder, readPendingOrder } from '../features/checkout/pending-order';
import { CheckoutPage } from './CheckoutPage';

const authState = vi.hoisted(() => ({ userId: 1 as number | null }));
vi.mock('../api/endpoints', () => ({ api: { listAddresses: vi.fn() } }));
vi.mock('../api/endpoints-shop', () => ({ shopApi: {
  cart: vi.fn(), validateCoupon: vi.fn(), createOrder: vi.fn(), startPayment: vi.fn(),
} }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({
  status: authState.userId === null ? 'guest' : 'authed', user: authState.userId === null ? null : { id: authState.userId },
}) }));

const address: Address = {
  id: 10, userId: 1, title: 'خانه', receiverName: 'کاربر', receiverPhone: '09120000000',
  province: 'تهران', city: 'تهران', fullAddress: 'نشانی', postalCode: null,
  lat: null, lng: null, isDefault: true, createdAt: '', updatedAt: '',
};

function cart(itemsTotal = 2_000_000, shippingCost: number | null = 75_000): CartView {
  return {
    items: [{ id: 1, variantId: 2, productName: 'غذای سگ', productSlug: 'dog-food',
      productImage: null, weightGram: 1000, unitPrice: itemsTotal, quantity: 1,
      total: itemsTotal, available: true }],
    itemsTotal,
    ...(shippingCost === null ? {} : { estimate: {
      itemsTotal, shippingCost, freeShippingThreshold: 1_500_000, note: '',
    } }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

async function changeInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function changeNote(input: HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('checkout server estimates and order safeguards', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  let mounted: boolean;

  async function renderCheckout() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter><CheckoutPage /></MemoryRouter>
        </QueryClientProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    if (authState.userId !== null) await vi.waitFor(() => expect(container.querySelector('form')).not.toBeNull());
  }

  async function updateCache(key: readonly string[], value: unknown) {
    await act(async () => {
      client.setQueryData(key, value);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  function couponInput() { return container.querySelector<HTMLInputElement>('input[dir="ltr"]')!; }
  function submitButton() { return container.querySelector<HTMLButtonElement>('button[type="submit"]')!; }
  function submitForm() {
    container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
  function shippingRow() {
    const label = [...container.querySelectorAll('dt')].find((item) => item.textContent?.includes('ارسال'));
    return { label: label?.textContent ?? '', value: label?.nextElementSibling?.textContent ?? '' };
  }

  beforeEach(() => {
    authState.userId = 1;
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    mounted = true;
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
    vi.mocked(api.listAddresses).mockResolvedValue([address]);
    vi.mocked(shopApi.cart).mockResolvedValue(cart());
    vi.mocked(shopApi.validateCoupon).mockResolvedValue({ code: 'SAVE', discountAmount: 100_000, finalAmount: 1_900_000 });
  });

  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    client.clear();
    clearPendingOrder();
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses a valid server shipping estimate even when the local threshold would say free, including zero', async () => {
    await renderCheckout();
    expect(shippingRow()).toMatchObject({ label: 'ارسال (برآورد سرور)', value: '۷۵٬۰۰۰ تومان' });
    await updateCache(queryKeys.cart, cart(2_000_000, 0));
    expect(shippingRow()).toMatchObject({ label: 'ارسال (برآورد سرور)', value: 'رایگان' });
  });

  it('does not query private data or send writes when mounted as a guest', async () => {
    authState.userId = null;
    await renderCheckout();
    expect(container.querySelector('a[href="/login?next=/checkout"]')).not.toBeNull();
    expect(container.querySelector('form')).toBeNull();
    expect(api.listAddresses).not.toHaveBeenCalled();
    expect(shopApi.cart).not.toHaveBeenCalled();
    expect(shopApi.validateCoupon).not.toHaveBeenCalled();
    expect(shopApi.createOrder).not.toHaveBeenCalled();
    expect(shopApi.startPayment).not.toHaveBeenCalled();
  });

  it('labels a missing or invalid server shipping estimate as a local fallback', async () => {
    vi.mocked(shopApi.cart).mockResolvedValue(cart(1_000_000, -1));
    await renderCheckout();
    expect(shippingRow().label).toContain('برآورد محلی');
    expect(shippingRow().value).toBe('۵۰٬۰۰۰ تومان');
    await updateCache(queryKeys.cart, cart(2_000_000, null));
    expect(shippingRow().label).toContain('برآورد محلی');
    expect(shippingRow().value).toBe('رایگان');
  });

  it('discards delayed coupon results when the typed code changes and sends only the current validated code', async () => {
    const old = deferred<CouponPreview>();
    vi.mocked(shopApi.validateCoupon).mockReturnValueOnce(old.promise).mockResolvedValueOnce({
      code: 'NEW', discountAmount: 50_000, finalAmount: 1_950_000,
    });
    const pendingOrder = deferred<Awaited<ReturnType<typeof shopApi.createOrder>>>();
    vi.mocked(shopApi.createOrder).mockReturnValue(pendingOrder.promise);
    await renderCheckout();
    await changeInput(couponInput(), 'OLD');
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="button"]')?.click());
    await changeInput(couponInput(), 'NEW');
    await act(async () => old.resolve({ code: 'OLD', discountAmount: 900_000, finalAmount: 1_100_000 }));
    expect(container.textContent).not.toContain('۹۰۰٬۰۰۰ تومان');
    expect(submitButton().disabled).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="button"]')?.click());
    expect(container.textContent).toContain('۵۰٬۰۰۰ تومان اعمال شد');
    await act(async () => submitForm());
    expect(shopApi.createOrder).toHaveBeenCalledWith({ addressId: 10, couponCode: 'NEW', note: undefined });
    expect(Object.keys(vi.mocked(shopApi.createOrder).mock.calls[0]![0])).toEqual(['addressId', 'couponCode', 'note']);
    await act(async () => pendingOrder.reject(new Error('offline')));
  });

  it('discards a delayed coupon after the cart snapshot changes', async () => {
    const pending = deferred<CouponPreview>();
    vi.mocked(shopApi.validateCoupon).mockReturnValue(pending.promise);
    await renderCheckout();
    await changeInput(couponInput(), 'SAVE');
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="button"]')?.click());
    await updateCache(queryKeys.cart, cart(1_000_000, 50_000));
    await act(async () => pending.resolve({ code: 'SAVE', discountAmount: 100_000, finalAmount: 900_000 }));
    expect(container.textContent).not.toContain('۱۰۰٬۰۰۰ تومان اعمال شد');
    expect(submitButton().disabled).toBe(true);
  });

  it('does not revive a validated coupon when the cart changes and later returns to its old fingerprint', async () => {
    await renderCheckout();
    await changeInput(couponInput(), 'SAVE');
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="button"]')?.click());
    expect(container.textContent).toContain('۱۰۰٬۰۰۰ تومان اعمال شد');
    await updateCache(queryKeys.cart, cart(1_000_000, 50_000));
    await updateCache(queryKeys.cart, cart());
    expect(container.textContent).not.toContain('۱۰۰٬۰۰۰ تومان اعمال شد');
    expect(submitButton().disabled).toBe(true);
  });

  it('ignores an in-flight coupon response even if the cart returns to the original fingerprint', async () => {
    const pending = deferred<CouponPreview>();
    vi.mocked(shopApi.validateCoupon).mockReturnValue(pending.promise);
    await renderCheckout();
    await changeInput(couponInput(), 'SAVE');
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="button"]')?.click());
    await updateCache(queryKeys.cart, cart(1_000_000, 50_000));
    await updateCache(queryKeys.cart, cart());
    await act(async () => pending.resolve({ code: 'SAVE', discountAmount: 100_000, finalAmount: 1_900_000 }));
    expect(container.textContent).not.toContain('۱۰۰٬۰۰۰ تومان اعمال شد');
    expect(submitButton().disabled).toBe(true);
  });

  it('blocks double submission, an absent selected address, and cart refetch', async () => {
    const pendingOrder = deferred<Awaited<ReturnType<typeof shopApi.createOrder>>>();
    vi.mocked(shopApi.createOrder).mockReturnValue(pendingOrder.promise);
    await renderCheckout();
    await act(async () => { submitForm(); submitForm(); });
    expect(shopApi.createOrder).toHaveBeenCalledTimes(1);
    await act(async () => pendingOrder.reject(new Error('offline')));
    await updateCache(queryKeys.addresses, []);
    expect(submitButton().disabled).toBe(true);
    await act(async () => submitForm());
    expect(shopApi.createOrder).toHaveBeenCalledTimes(1);
    await updateCache(queryKeys.addresses, [address]);
    const nextCart = deferred<CartView>();
    vi.mocked(shopApi.cart).mockReturnValueOnce(nextCart.promise);
    await act(async () => {
      void client.refetchQueries({ queryKey: queryKeys.cart });
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(submitButton().disabled).toBe(true);
    await act(async () => submitForm());
    expect(shopApi.createOrder).toHaveBeenCalledTimes(1);
    await act(async () => nextCart.resolve(cart()));
  });

  it('limits the order note to the backend contract without sending any client-calculated amount', async () => {
    const pendingOrder = deferred<Awaited<ReturnType<typeof shopApi.createOrder>>>();
    vi.mocked(shopApi.createOrder).mockReturnValue(pendingOrder.promise);
    await renderCheckout();
    const note = container.querySelector<HTMLTextAreaElement>('#note')!;
    expect(note.maxLength).toBe(500);
    await changeNote(note, 'x'.repeat(510));
    expect(note.value).toHaveLength(500);
    await act(async () => submitForm());
    expect(shopApi.createOrder).toHaveBeenCalledWith({ addressId: 10, couponCode: undefined, note: 'x'.repeat(500) });
    expect(Object.keys(vi.mocked(shopApi.createOrder).mock.calls[0]![0])).toEqual(['addressId', 'couponCode', 'note']);
    await act(async () => pendingOrder.reject(new Error('offline')));
  });

  it('retries payment for an already created order without creating a second order', async () => {
    vi.mocked(shopApi.createOrder).mockResolvedValue({ id: 44, orderNumber: 'O-44' } as Awaited<ReturnType<typeof shopApi.createOrder>>);
    vi.mocked(shopApi.startPayment).mockRejectedValue(new Error('gateway offline'));
    await renderCheckout();
    await act(async () => submitForm());
    expect(shopApi.createOrder).toHaveBeenCalledTimes(1);
    expect(shopApi.startPayment).toHaveBeenCalledWith(44);
    const retry = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('همین سفارش'))!;
    expect(retry.disabled).toBe(false);
    await act(async () => retry.click());
    expect(shopApi.createOrder).toHaveBeenCalledTimes(1);
    expect(shopApi.startPayment).toHaveBeenCalledTimes(2);
    expect(container.querySelector('a[href="/orders/44"]')).not.toBeNull();
  });

  it('ignores an order created after the active account changes', async () => {
    const pendingOrder = deferred<Awaited<ReturnType<typeof shopApi.createOrder>>>();
    vi.mocked(shopApi.createOrder).mockReturnValue(pendingOrder.promise);
    await renderCheckout();
    await act(async () => submitForm());
    authState.userId = 2;
    await renderCheckout();
    await act(async () => pendingOrder.resolve({ id: 45, orderNumber: 'O-45' } as Awaited<ReturnType<typeof shopApi.createOrder>>));
    expect(shopApi.startPayment).not.toHaveBeenCalled();
    expect(readPendingOrder()).toBeNull();
    expect(container.querySelector('a[href="/orders/45"]')).toBeNull();
  });

  it('ignores an order created after checkout unmounts', async () => {
    const pendingOrder = deferred<Awaited<ReturnType<typeof shopApi.createOrder>>>();
    vi.mocked(shopApi.createOrder).mockReturnValue(pendingOrder.promise);
    await renderCheckout();
    await act(async () => submitForm());
    await act(async () => root.unmount());
    mounted = false;
    await act(async () => pendingOrder.resolve({ id: 47, orderNumber: 'O-47' } as Awaited<ReturnType<typeof shopApi.createOrder>>));
    expect(shopApi.startPayment).not.toHaveBeenCalled();
    expect(readPendingOrder()).toBeNull();
  });

  it('ignores a late payment response after the active account changes', async () => {
    const payment = deferred<{ paymentUrl: string }>();
    vi.mocked(shopApi.createOrder).mockResolvedValue({ id: 46, orderNumber: 'O-46' } as Awaited<ReturnType<typeof shopApi.createOrder>>);
    vi.mocked(shopApi.startPayment).mockReturnValue(payment.promise);
    await renderCheckout();
    await act(async () => submitForm());
    expect(shopApi.startPayment).toHaveBeenCalledWith(46);
    authState.userId = 2;
    await renderCheckout();
    expect(container.querySelector('a[href="/orders/46"]')).toBeNull();
    await act(async () => payment.resolve({ paymentUrl: 'https://gateway.example/pay/46' }));
    expect(container.querySelector('a[href="/orders/46"]')).toBeNull();
  });

  it('clears discount and failed-payment retry across A→B→A in the same mounted page', async () => {
    vi.mocked(shopApi.createOrder).mockResolvedValue({ id: 48, orderNumber: 'O-48' } as Awaited<ReturnType<typeof shopApi.createOrder>>);
    vi.mocked(shopApi.startPayment).mockRejectedValue(new Error('gateway offline'));
    await renderCheckout();
    await changeInput(couponInput(), 'SAVE');
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="button"]')?.click());
    expect(container.textContent).toContain('۱۰۰٬۰۰۰ تومان اعمال شد');
    await act(async () => submitForm());
    expect(container.querySelector('a[href="/orders/48"]')).not.toBeNull();
    authState.userId = 2;
    await renderCheckout();
    authState.userId = 1;
    await renderCheckout();
    expect(couponInput().value).toBe('');
    expect(container.textContent).not.toContain('۱۰۰٬۰۰۰ تومان اعمال شد');
    expect(container.querySelector('a[href="/orders/48"]')).toBeNull();
    expect([...container.querySelectorAll('button')].some((button) => button.textContent?.includes('همین سفارش'))).toBe(false);
  });
});
