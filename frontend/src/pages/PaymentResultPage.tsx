import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { OrderDetail } from '../api/types';
import { useAuth } from '../auth/auth-provider';
import { ErrorState, LoadingState } from '../components/states';
import { clearPendingOrder, readPendingOrder, writePendingOrder } from '../features/checkout/pending-order';
import { formatToman } from '../lib/format';
import { errorText, ORDER_STATUS_FA } from '../lib/labels';

/** A callback URL is only a lookup hint; authenticated server state confirms payment. */
export function PaymentResultPage() {
  const [params] = useSearchParams();
  const { status, user } = useAuth();
  const userId = status === 'authed' ? user?.id ?? null : null;
  const orderNumber = params.get('orderNumber') ?? '';
  return <PaymentResultSession key={`${userId ?? 'guest'}:${orderNumber}`} userId={userId}
    orderNumber={orderNumber} callbackStatus={params.get('status') ?? 'failed'} />;
}

function PaymentResultSession({ userId, orderNumber, callbackStatus }: {
  userId: number | null; orderNumber: string; callbackStatus: string;
}) {
  const queryClient = useQueryClient();
  const activeRef = useRef(false);
  const actionLock = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending] = useState(readPendingOrder);
  useLayoutEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);
  const pendingOrderId = pending?.orderNumber === orderNumber ? pending.orderId : null;

  const scan = useQuery({
    queryKey: queryKeys.orders(1),
    queryFn: async ({ signal }) => {
      const result = await shopApi.orders(1, 20);
      if (signal.aborted || !activeRef.current) throw new Error('نشست کاربری تغییر کرده است.');
      return result;
    },
    enabled: userId !== null && pendingOrderId === null && orderNumber.length > 0,
  });
  const found = scan.data?.data.find((item) => item.orderNumber === orderNumber &&
    Number.isSafeInteger(item.id) && item.id > 0);
  const orderId = pendingOrderId ?? found?.id ?? null;

  function assertOwnedOrder(value: OrderDetail): void {
    if (value.id !== orderId || value.userId !== userId || value.orderNumber !== orderNumber) {
      throw new Error('اطلاعات این سفارش برای حساب فعلی معتبر نیست.');
    }
  }
  const order = useQuery({
    queryKey: queryKeys.order(orderId ?? -1),
    queryFn: async ({ signal }) => {
      const result = await shopApi.order(orderId as number);
      if (signal.aborted || !activeRef.current) throw new Error('نشست کاربری تغییر کرده است.');
      assertOwnedOrder(result);
      return result;
    },
    enabled: userId !== null && orderId !== null,
  });
  const detail = order.data?.userId === userId && order.data.orderNumber === orderNumber &&
    order.data.id === orderId ? order.data : null;
  const paymentConfirmed = detail && ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(detail.status);
  useEffect(() => {
    if (activeRef.current && found && detail?.status === 'PENDING_PAYMENT') {
      writePendingOrder({ orderId: detail.id, orderNumber: detail.orderNumber });
    }
  }, [found, detail]);

  async function refreshOrder(refreshCart = false) {
    if (!activeRef.current) return;
    // The orders prefix includes this detail query and every list page.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ...(refreshCart ? [queryClient.invalidateQueries({ queryKey: queryKeys.cart })] : []),
    ]);
  }

  const action = useMutation({
    mutationFn: async (kind: 'pay' | 'cancel') => {
      const current = queryClient.getQueryData<OrderDetail>(queryKeys.order(orderId ?? -1));
      if (!activeRef.current || !current || current.status !== 'PENDING_PAYMENT') {
        throw new Error('این سفارش در وضعیت قابل پرداخت یا لغو نیست.');
      }
      assertOwnedOrder(current);
      if (kind === 'cancel') return { kind, result: await shopApi.cancelOrder(current.id) } as const;
      return { kind, result: await shopApi.startPayment(current.id) } as const;
    },
    onSuccess: async (response) => {
      if (!activeRef.current) return;
      if (response.kind === 'cancel') {
        assertOwnedOrder(response.result);
        await queryClient.cancelQueries({ queryKey: queryKeys.order(response.result.id) });
        if (!activeRef.current) return;
        queryClient.setQueryData(queryKeys.order(response.result.id), response.result);
        const marker = readPendingOrder();
        if (marker?.orderId === response.result.id && marker.orderNumber === response.result.orderNumber) {
          clearPendingOrder();
        }
        await refreshOrder(true);
        if (activeRef.current) setNotice('سفارش لغو شد.');
      } else {
        const current = queryClient.getQueryData<OrderDetail>(queryKeys.order(orderId ?? -1));
        if (!current || current.status !== 'PENDING_PAYMENT') {
          throw new Error('وضعیت سفارش تغییر کرده است. دوباره آن را بررسی کنید.');
        }
        assertOwnedOrder(current);
        writePendingOrder({ orderId: current.id, orderNumber: current.orderNumber });
        window.location.assign(response.result.paymentUrl);
      }
    },
    onError: async (error) => {
      if (!activeRef.current) return;
      setNotice(errorText(error));
      await refreshOrder();
    },
    onSettled: () => {
      if (activeRef.current) actionLock.current = false;
    },
  });

  function runAction(kind: 'pay' | 'cancel') {
    if (!detail || userId === null || detail.status !== 'PENDING_PAYMENT' || actionLock.current ||
        order.isFetching || !activeRef.current) return;
    actionLock.current = true;
    setNotice(null);
    action.mutate(kind);
  }

  if (!orderNumber) return <section><h1>نتیجه پرداخت</h1><p>
    اطلاعات سفارش در آدرس موجود نیست. <Link to="/orders">سفارش‌های من</Link>
  </p></section>;

  return <section>
    <h1>نتیجه پرداخت</h1><p dir="ltr">{orderNumber}</p>
    {paymentConfirmed && <p role="status">پرداخت این سفارش در سامانه تأیید شده است.</p>}
    {!paymentConfirmed && callbackStatus === 'success' && <p role="status">
      در حال بررسی نتیجهٔ پرداخت هستیم. وضعیت قطعی را در جزئیات سفارش ببینید.
    </p>}
    {!paymentConfirmed && callbackStatus !== 'success' && <p>
      تأیید پرداخت دریافت نشده است. وضعیت سفارش را بررسی کنید.
    </p>}
    {(order.isLoading || scan.isLoading) && <LoadingState />}
    {(order.error || scan.error) && <ErrorState error={order.error ?? scan.error}
      onRetry={() => void (orderId !== null ? order.refetch() : scan.refetch())} />}
    {detail && <>
      <dl><dt>وضعیت</dt><dd>{ORDER_STATUS_FA[detail.status]}</dd>
        <dt>مبلغ</dt><dd dir="ltr">{formatToman(detail.finalAmount)}</dd></dl>
      {detail.status === 'PENDING_PAYMENT' && <div>
        <button type="button" disabled={action.isPending || order.isFetching} onClick={() => runAction('pay')}>پرداخت مجدد</button>
        <button type="button" disabled={action.isPending || order.isFetching} onClick={() => runAction('cancel')}>انصراف از سفارش</button>
      </div>}
      <p><Link to={`/orders/${detail.id}`}>مشاهدهٔ جزئیات سفارش</Link> · <Link to="/orders">سفارش‌های من</Link></p>
    </>}
    {!order.isLoading && orderId === null && !scan.isLoading && !scan.error && <p>
      سفارش پیدا نشد. <Link to="/orders">سفارش‌های من را ببینید</Link>.
    </p>}
    {notice && <p role="alert">{notice}</p>}
  </section>;
}
