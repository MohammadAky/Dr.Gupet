// @vitest-environment jsdom
import { defaultScheduler, notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { OrderDetail, OrderStatus, OrderSummary } from '../api/types';
import { clearPendingOrder, readPendingOrder, writePendingOrder } from '../features/checkout/pending-order';
import { PaymentResultPage } from './PaymentResultPage';

const auth = vi.hoisted(() => ({ userId: 1 as number | null }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({
  status: auth.userId === null ? 'guest' : 'authed', user: auth.userId === null ? null : { id: auth.userId },
}) }));
vi.mock('../api/endpoints-shop', () => ({ shopApi: {
  order: vi.fn(), orders: vi.fn(), startPayment: vi.fn(), cancelOrder: vi.fn(),
} }));

const fixture: OrderDetail = {
  id: 8, orderNumber: 'O-8', userId: 1, status: 'PENDING_PAYMENT',
  addressSnapshot: { title: 'خانه', receiverName: 'کاربر', receiverPhone: '09120000000',
    province: 'تهران', city: 'تهران', fullAddress: 'نشانی', postalCode: null },
  itemsTotal: 100_000, discountAmount: 0, shippingCost: 50_000, finalAmount: 150_000,
  shippingMethod: null, trackingCode: null, shippedAt: null, deliveredAt: null, note: null,
  couponId: null, createdAt: '', updatedAt: '', items: [], payments: [],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('payment result server truth and session boundaries', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  let mounted: boolean;
  const assign = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    notifyManager.setScheduler(queueMicrotask);
    auth.userId = 1;
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const browserWindow = window;
    vi.stubGlobal('window', new Proxy(browserWindow, {
      get(target, key) { return key === 'location' ? { assign } : Reflect.get(target, key, target); },
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    mounted = true;
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
    vi.mocked(shopApi.order).mockResolvedValue(fixture);
    vi.mocked(shopApi.orders).mockResolvedValue({ data: [] });
    vi.mocked(shopApi.startPayment).mockResolvedValue({ paymentUrl: 'https://www.zarinpal.com/pg/StartPay/A' });
    vi.mocked(shopApi.cancelOrder).mockResolvedValue({ ...fixture, status: 'CANCELED' });
    writePendingOrder({ orderId: 8, orderNumber: 'O-8' });
  });

  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    client.clear(); clearPendingOrder(); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
    notifyManager.setScheduler(defaultScheduler);
  });

  async function renderPage(url = '/payment/result?orderNumber=O-8&status=success') {
    await act(async () => {
      root.render(<QueryClientProvider client={client}><MemoryRouter key={url} initialEntries={[url]}>
        <PaymentResultPage />
      </MemoryRouter></QueryClientProvider>);
    });
  }
  async function settle(operation: () => void) {
    await act(async () => { operation(); });
  }
  function button(label: string) {
    const found = [...container.querySelectorAll('button')].find((item) => item.textContent === label);
    if (!found) throw new Error(`Missing button: ${label}`);
    return found;
  }

  it('does not accept a success URL as proof, and confirms paid server states even for a failed URL', async () => {
    await renderPage();
    expect(container.textContent).not.toContain('پرداخت این سفارش در سامانه تأیید شده است.');
    expect(container.textContent).toContain('در انتظار پرداخت');
    for (const status of ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as OrderStatus[]) {
      await settle(() => client.setQueryData(queryKeys.order(8), { ...fixture, status }));
      expect(container.textContent).toContain('پرداخت این سفارش در سامانه تأیید شده است.');
      expect(container.textContent).not.toContain('پرداخت مجدد');
    }
    await renderPage('/payment/result?orderNumber=O-8&status=failed');
    expect(container.textContent).toContain('پرداخت این سفارش در سامانه تأیید شده است.');
  });

  it('does not expose pay/cancel actions for canceled orders, empty lookup, or guests', async () => {
    vi.mocked(shopApi.order).mockResolvedValue({ ...fixture, status: 'CANCELED' });
    await renderPage('/payment/result?orderNumber=O-8&status=failed');
    expect(container.textContent).not.toContain('پرداخت مجدد');
    expect(container.textContent).not.toContain('انصراف از سفارش');
    auth.userId = null;
    await renderPage();
    expect(container.querySelector('a[href="/orders/8"]')).toBeNull();
    expect(shopApi.startPayment).not.toHaveBeenCalled();
    await renderPage('/payment/result');
    expect(container.textContent).toContain('اطلاعات سفارش در آدرس موجود نیست.');
  });

  it('rejects malformed stored IDs and resolves an owned order through the list', async () => {
    window.sessionStorage.setItem('drgupet.pendingOrder', JSON.stringify({ orderId: 1.5, orderNumber: 'O-8' }));
    vi.mocked(shopApi.orders).mockResolvedValue({ data: [fixture as unknown as OrderSummary] });
    await renderPage();
    await vi.waitFor(() => expect(shopApi.order).toHaveBeenCalledWith(8));
    await settle(() => {});
    expect(shopApi.order).not.toHaveBeenCalledWith(1.5);
    expect(readPendingOrder()).toEqual({ orderId: 8, orderNumber: 'O-8' });
  });

  it('never displays or persists a detail belonging to a different account or number', async () => {
    clearPendingOrder();
    vi.mocked(shopApi.orders).mockResolvedValue({ data: [fixture as unknown as OrderSummary] });
    vi.mocked(shopApi.order).mockResolvedValue({ ...fixture, userId: 2, status: 'PAID' });
    await renderPage();
    await vi.waitFor(() => expect(container.textContent).toContain('اطلاعات این سفارش برای حساب فعلی معتبر نیست.'));
    expect(container.textContent).not.toContain('پرداخت این سفارش در سامانه تأیید شده است.');
    expect(readPendingOrder()).toBeNull();
    expect(client.getQueryData(queryKeys.order(8))).toBeUndefined();
  });

  it('makes pay and cancel mutually exclusive in the same event turn', async () => {
    const payment = deferred<{ paymentUrl: string }>();
    vi.mocked(shopApi.startPayment).mockReturnValue(payment.promise);
    await renderPage();
    const pay = button('پرداخت مجدد');
    const cancel = button('انصراف از سفارش');
    await settle(() => { pay.click(); cancel.click(); pay.click(); });
    expect(shopApi.startPayment).toHaveBeenCalledTimes(1);
    expect(shopApi.cancelOrder).not.toHaveBeenCalled();
    expect(pay.disabled).toBe(true); expect(cancel.disabled).toBe(true);
    await settle(() => payment.resolve({ paymentUrl: 'https://www.zarinpal.com/pg/StartPay/A' }));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(readPendingOrder()).toEqual({ orderId: 8, orderNumber: 'O-8' });
  });

  it('refreshes server status after payment fails and unlocks retry', async () => {
    vi.mocked(shopApi.startPayment).mockRejectedValueOnce(new Error('درگاه در دسترس نیست'));
    await renderPage();
    await settle(() => button('پرداخت مجدد').click());
    expect(container.textContent).toContain('درگاه در دسترس نیست');
    expect(shopApi.order).toHaveBeenCalledTimes(2);
    expect(button('پرداخت مجدد').disabled).toBe(false);
    await settle(() => button('پرداخت مجدد').click());
    expect(shopApi.startPayment).toHaveBeenCalledTimes(2);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('refreshes canceled order/list/cart and clears only its matching pending marker', async () => {
    client.setQueryData(queryKeys.cart, { items: [], itemsTotal: 0 });
    client.setQueryData(queryKeys.orders(2), { data: [] });
    vi.mocked(shopApi.order).mockResolvedValueOnce(fixture).mockResolvedValue({ ...fixture, status: 'CANCELED' });
    await renderPage();
    await settle(() => { button('انصراف از سفارش').click(); button('پرداخت مجدد').click(); });
    expect(shopApi.cancelOrder).toHaveBeenCalledTimes(1);
    expect(shopApi.startPayment).not.toHaveBeenCalled();
    expect(container.textContent).toContain('سفارش لغو شد.');
    expect(container.textContent).not.toContain('پرداخت مجدد');
    expect(readPendingOrder()).toBeNull();
    expect(client.getQueryState(queryKeys.cart)?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.orders(2))?.isInvalidated).toBe(true);
    expect(client.getQueryData<OrderDetail>(queryKeys.order(8))?.status).toBe('CANCELED');
  });

  it('discards a payment response after account switch without navigation or marker writes', async () => {
    const payment = deferred<{ paymentUrl: string }>();
    vi.mocked(shopApi.startPayment).mockReturnValue(payment.promise);
    await renderPage();
    await settle(() => button('پرداخت مجدد').click());
    clearPendingOrder();
    auth.userId = 2;
    await renderPage();
    await settle(() => payment.resolve({ paymentUrl: 'https://www.zarinpal.com/pg/StartPay/A' }));
    expect(assign).not.toHaveBeenCalled();
    expect(readPendingOrder()).toBeNull();
    expect(container.querySelector('a[href="/orders/8"]')).toBeNull();
  });

  it('discards cancellation after unmount without contaminating the next account cache or storage', async () => {
    const cancellation = deferred<OrderDetail>();
    vi.mocked(shopApi.cancelOrder).mockReturnValue(cancellation.promise);
    await renderPage();
    await settle(() => button('انصراف از سفارش').click());
    await act(async () => root.unmount()); mounted = false;
    const nextOrder = { ...fixture, userId: 2, status: 'PAID' as const };
    client.setQueryData(queryKeys.order(8), nextOrder);
    writePendingOrder({ orderId: 9, orderNumber: 'O-9' });
    await settle(() => cancellation.resolve({ ...fixture, status: 'CANCELED' }));
    expect(client.getQueryData(queryKeys.order(8))).toEqual(nextOrder);
    expect(client.getQueryState(queryKeys.order(8))?.isInvalidated).toBe(false);
    expect(readPendingOrder()).toEqual({ orderId: 9, orderNumber: 'O-9' });
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not cache a late detail query after the session unmounts', async () => {
    const result = deferred<OrderDetail>();
    vi.mocked(shopApi.order).mockReturnValue(result.promise);
    await renderPage();
    await act(async () => root.unmount()); mounted = false;
    clearPendingOrder();
    await settle(() => result.resolve(fixture));
    expect(client.getQueryData(queryKeys.order(8))).toBeUndefined();
    expect(readPendingOrder()).toBeNull();
  });
});
