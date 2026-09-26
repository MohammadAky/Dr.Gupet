import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { ErrorState, LoadingState } from '../components/states';
import { writePendingOrder } from '../features/checkout/pending-order';
import { ORDER_EXPIRE_MINUTES } from '../lib/constants';
import { formatJalali } from '../lib/jalali';
import { formatToman, formatWeight } from '../lib/format';
import { errorText, ORDER_STATUS_FA, PAYMENT_STATUS_FA } from '../lib/labels';

/** Order detail (F9): snapshots, totals, cancel while PENDING_PAYMENT, retry payment. */
export function OrderDetailPage() {
  const { id = '' } = useParams();
  const orderId = Number(id);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const order = useQuery({
    queryKey: queryKeys.order(orderId),
    queryFn: () => shopApi.order(orderId),
    enabled: Number.isFinite(orderId) && orderId > 0,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
  }

  const cancel = useMutation({
    mutationFn: () => shopApi.cancelOrder(orderId),
    onSuccess: () => {
      invalidate();
      setNotice('سفارش لغو شد.');
    },
    onError: (error) => setNotice(errorText(error)),
  });

  const startPayment = useMutation({
    mutationFn: () => shopApi.startPayment(orderId),
    onSuccess: ({ paymentUrl }) => {
      if (order.data)
        writePendingOrder({ orderId: order.data.id, orderNumber: order.data.orderNumber });
      window.location.assign(paymentUrl);
    },
    onError: (error) => setNotice(errorText(error)),
  });

  if (order.isLoading) return <LoadingState />;
  if (order.error) return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;
  if (!order.data) return null;

  const detail = order.data;
  const snapshot = detail.addressSnapshot;
  const latestPayment = detail.payments[0];

  return (
    <article>
      <h1>جزئیات سفارش</h1>
      <p dir="ltr">{detail.orderNumber}</p>
      <p>
        {formatJalali(detail.createdAt, 'datetime')} ·{' '}
        <strong>{ORDER_STATUS_FA[detail.status]}</strong>
      </p>

      {detail.status === 'PENDING_PAYMENT' && (
        <>
          <p role="alert">
            این سفارش تا {ORDER_EXPIRE_MINUTES} دقیقه قابل پرداخت است؛ پس از آن به‌صورت خودکار لغو
            می‌شود.
          </p>
          <button
            type="button"
            disabled={startPayment.isPending}
            onClick={() => startPayment.mutate()}
          >
            پرداخت
          </button>
          <button type="button" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
            لغو سفارش
          </button>
        </>
      )}
      {latestPayment && (
        <p>
          آخرین پرداخت: {PAYMENT_STATUS_FA[latestPayment.status]}{' '}
          {formatJalali(latestPayment.createdAt, 'datetime')}
        </p>
      )}

      <section>
        <h2>اقلام</h2>
        <ul>
          {detail.items.map((item) => (
            <li key={item.id}>
              {item.productName} — {formatWeight(item.weightGram)} × {item.quantity} ={' '}
              <span dir="ltr">{formatToman(item.total)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>آدرس (snapshot)</h2>
        <p>
          {snapshot.receiverName} — {snapshot.title}
        </p>
        <p dir="ltr">{snapshot.receiverPhone}</p>
        <p>
          {snapshot.province}، {snapshot.city}، {snapshot.fullAddress}
        </p>
        {snapshot.postalCode && <p dir="ltr">{snapshot.postalCode}</p>}
      </section>

      <section>
        <h2>مالی</h2>
        <dl>
          <dt>جمع کالاها</dt>
          <dd dir="ltr">{formatToman(detail.itemsTotal)}</dd>
          <dt>تخفیف</dt>
          <dd dir="ltr">{formatToman(detail.discountAmount)}</dd>
          <dt>ارسال</dt>
          <dd dir="ltr">
            {detail.shippingCost === 0 ? 'رایگان' : formatToman(detail.shippingCost)}
          </dd>
          <dt>نهایی</dt>
          <dd dir="ltr">{formatToman(detail.finalAmount)}</dd>
        </dl>
      </section>

      {detail.trackingCode && (
        <section>
          <h2>ارسال</h2>
          <p dir="ltr">{detail.trackingCode}</p>
          {detail.shippedAt && <p>ارسال شده: {formatJalali(detail.shippedAt, 'datetime')}</p>}
          {detail.deliveredAt && <p>تحویل شده: {formatJalali(detail.deliveredAt, 'datetime')}</p>}
        </section>
      )}

      {notice && <p role="alert">{notice}</p>}

      <p>
        <Link to="/orders">بازگشت به سفارش‌ها</Link>
      </p>
    </article>
  );
}
