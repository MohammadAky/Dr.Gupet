import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { ErrorState, LoadingState } from '../components/states';
import {
  clearPendingOrder,
  readPendingOrder,
  writePendingOrder,
} from '../features/checkout/pending-order';
import { ORDER_EXPIRE_MINUTES } from '../lib/constants';
import { formatToman } from '../lib/format';
import { errorText, ORDER_STATUS_FA } from '../lib/labels';

/**
 * Payment result page — the gateway redirects here with
 * `?orderNumber=...&status=success|failed` (FRONTEND_PAYMENT_RESULT_URL).
 * Order resolution: sessionStorage pair (BE-REQ-02) → orders list scan.
 */
export function PaymentResultPage() {
  const [params] = useSearchParams();
  const queryClient = useQueryClient();

  const orderNumber = params.get('orderNumber') ?? '';
  const status = params.get('status') ?? 'failed';

  const pending = readPendingOrder();
  const pendingOrderId = pending && pending.orderNumber === orderNumber ? pending.orderId : null;
  const [notice, setNotice] = useState<string | null>(null);

  const scan = useQuery({
    queryKey: queryKeys.orders(1),
    queryFn: () => shopApi.orders(1, 20),
    enabled: pendingOrderId === null && orderNumber.length > 0,
  });

  const found = scan.data?.data.find((order) => order.orderNumber === orderNumber);
  const orderId = pendingOrderId ?? found?.id ?? null;

  useEffect(() => {
    if (found) writePendingOrder({ orderId: found.id, orderNumber: found.orderNumber });
  }, [found]);

  const order = useQuery({
    queryKey: queryKeys.order(orderId ?? -1),
    queryFn: () => shopApi.order(orderId as number),
    enabled: orderId !== null,
  });
  // The callback query is user-editable. Only the server's order state can confirm payment.
  const paymentConfirmed =
    order.data && ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.data.status);

  const startPayment = useMutation({
    mutationFn: () => shopApi.startPayment(orderId as number),
    onSuccess: ({ paymentUrl }) => {
      if (order.data)
        writePendingOrder({ orderId: order.data.id, orderNumber: order.data.orderNumber });
      window.location.assign(paymentUrl);
    },
    onError: (error) => setNotice(errorText(error)),
  });

  const cancelOrder = useMutation({
    mutationFn: () => shopApi.cancelOrder(orderId as number),
    onSuccess: () => {
      clearPendingOrder();
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      setNotice('سفارش لغو شد.');
    },
    onError: (error) => setNotice(errorText(error)),
  });

  if (!orderNumber) {
    return (
      <section>
        <h1>نتیجه پرداخت</h1>
        <p>
          اطلاعات سفارش در آدرس موجود نیست. <Link to="/orders">سفارش‌های من</Link>
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1>نتیجه پرداخت</h1>
      <p dir="ltr">{orderNumber}</p>

      {paymentConfirmed && <p role="status">پرداخت این سفارش در سامانه تأیید شده است.</p>}
      {!paymentConfirmed && status === 'success' && (
        <p role="status">در حال بررسی نتیجهٔ پرداخت هستیم. وضعیت قطعی را در جزئیات سفارش ببینید.</p>
      )}
      {!paymentConfirmed && status !== 'success' && (
        <p role="alert">
          پرداخت ناموفق بود. تا {ORDER_EXPIRE_MINUTES} دقیقه می‌توانید دوباره تلاش کنید یا سفارش را
          لغو کنید.
        </p>
      )}

      {(order.isLoading || scan.isLoading) && <LoadingState />}
      {(order.error || scan.error) && (
        <ErrorState
          error={order.error ?? scan.error}
          onRetry={() => void (orderId !== null ? order.refetch() : scan.refetch())}
        />
      )}

      {order.data && (
        <>
          <dl>
            <dt>وضعیت</dt>
            <dd>{ORDER_STATUS_FA[order.data.status]}</dd>
            <dt>مبلغ</dt>
            <dd dir="ltr">{formatToman(order.data.finalAmount)}</dd>
          </dl>

          {order.data.status === 'PENDING_PAYMENT' && (
            <div>
              <button
                type="button"
                disabled={startPayment.isPending}
                onClick={() => {
                  startPayment.mutate();
                }}
              >
                پرداخت مجدد
              </button>
              <button
                type="button"
                disabled={cancelOrder.isPending}
                onClick={() => cancelOrder.mutate()}
              >
                انصراف از سفارش
              </button>
            </div>
          )}

          <p>
            <Link to={`/orders/${order.data.id}`}>مشاهدهٔ جزئیات سفارش</Link> ·{' '}
            <Link to="/orders">سفارش‌های من</Link>
          </p>
        </>
      )}

      {!order.isLoading && orderId === null && !scan.isLoading && (
        <p>
          سفارش پیدا نشد. <Link to="/orders">سفارش‌های من را ببینید</Link>.
        </p>
      )}

      {notice && <p role="alert">{notice}</p>}
    </section>
  );
}
