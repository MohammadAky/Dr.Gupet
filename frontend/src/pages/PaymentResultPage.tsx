import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { ErrorState, LoadingState } from '../components/states';
import { clearPendingOrder, readPendingOrder, writePendingOrder } from '../features/checkout/pending-order';
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
  const [orderId, setOrderId] = useState<number | null>(
    pending && pending.orderNumber === orderNumber ? pending.orderId : null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const scan = useQuery({
    queryKey: queryKeys.orders(1),
    queryFn: () => shopApi.orders(1, 20),
    enabled: orderId === null && orderNumber.length > 0,
  });

  useEffect(() => {
    if (orderId !== null || !scan.data || !orderNumber) return;
    const found = scan.data.data.find((order) => order.orderNumber === orderNumber);
    if (found) {
      setOrderId(found.id);
      writePendingOrder({ orderId: found.id, orderNumber: found.orderNumber });
    }
  }, [scan.data, orderNumber, orderId]);

  const order = useQuery({
    queryKey: queryKeys.order(orderId ?? -1),
    queryFn: () => shopApi.order(orderId as number),
    enabled: orderId !== null,
  });

  const startPayment = useMutation({
    mutationFn: () => shopApi.startPayment(orderId as number),
    onSuccess: ({ paymentUrl }) => window.location.assign(paymentUrl),
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

      {status === 'success' && <p role="status">پرداخت با موفقیت انجام شد.</p>}
      {status !== 'success' && (
        <p role="alert">
          پرداخت ناموفق بود. تا {ORDER_EXPIRE_MINUTES} دقیقه می‌توانید دوباره تلاش کنید یا سفارش را لغو کنید.
        </p>
      )}

      {(order.isLoading || scan.isLoading) && <LoadingState />}
      {(order.error || scan.error) && (
        <ErrorState error={order.error ?? scan.error} onRetry={() => void order.refetch()} />
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
                  clearPendingOrder();
                  startPayment.mutate();
                }}
              >
                پرداخت مجدد
              </button>
              <button type="button" disabled={cancelOrder.isPending} onClick={() => cancelOrder.mutate()}>
                انصراف از سفارش
              </button>
            </div>
          )}

          <p>
            <Link to={`/orders/${order.data.id}`}>مشاهدهٔ جزئیات سفارش</Link> · <Link to="/orders">سفارش‌های من</Link>
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