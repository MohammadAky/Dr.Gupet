import '../styles/content-pages.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { ErrorState, LoadingState } from '../components/states';
import {
  clearPendingOrder,
  readPendingOrder,
  writePendingOrder,
} from '../features/checkout/pending-order';
import { formatJalali } from '../lib/jalali';
import { formatToman, formatWeight } from '../lib/format';
import { errorText, ORDER_STATUS_FA, PAYMENT_STATUS_FA } from '../lib/labels';
import { AccountNav } from '../components/AccountNav';
import { useAuth } from '../auth/auth-provider';
import { ConfirmDialog } from '../components/ConfirmDialog';

/** Order detail (F9): snapshots, totals, cancel while PENDING_PAYMENT, retry payment. */
export function OrderDetailPage() {
  const { status, user } = useAuth();
  const { id } = useParams();
  if (status === 'loading') return <LoadingState layout="detail" />;
  if (status !== 'authed' || !user) return <p>برای دیدن سفارش وارد حساب شوید.</p>;
  return <OrderDetailSession key={`${user.id}:${id}`} userId={user.id} />;
}

function OrderDetailSession({ userId }: { userId: number }) {
  const { id = '' } = useParams();
  const orderId = Number(id);
  const validId = Number.isSafeInteger(orderId) && orderId > 0;
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'success' | 'error'>('error');
  const [cancelOpen, setCancelOpen] = useState(false);
  const actionLock = useRef(false);
  const active = useRef(true);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const order = useQuery({
    queryKey: queryKeys.order(orderId),
    queryFn: async ({ signal }) => {
      const result = await shopApi.order(orderId);
      if (signal.aborted || !active.current)
        throw new DOMException('Inactive session', 'AbortError');
      if (result.id !== orderId || result.userId !== userId)
        throw new Error('اطلاعات این سفارش برای حساب فعلی معتبر نیست.');
      return result;
    },
    enabled: validId,
  });

  function invalidate() {
    if (!active.current) return;
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
  }

  const cancel = useMutation({
    mutationFn: () => shopApi.cancelOrder(orderId),
    onSuccess: (result) => {
      if (!active.current) return;
      if (result.id !== orderId || result.userId !== userId)
        throw new Error('اطلاعات این سفارش برای حساب فعلی معتبر نیست.');
      queryClient.setQueryData(queryKeys.order(orderId), result);
      const marker = readPendingOrder();
      if (marker?.orderId === orderId && marker.orderNumber === result.orderNumber)
        clearPendingOrder();
      invalidate();
      setNoticeKind('success');
      setNotice('سفارش لغو شد.');
    },
    onError: (error) => {
      if (active.current) {
        setNoticeKind('error');
        setNotice(errorText(error));
        invalidate();
      }
    },
    onSettled: () => {
      if (active.current) actionLock.current = false;
    },
  });

  const startPayment = useMutation({
    mutationFn: () => shopApi.startPayment(orderId),
    onSuccess: ({ paymentUrl }) => {
      if (!active.current) return;
      if (order.data)
        writePendingOrder({ orderId: order.data.id, orderNumber: order.data.orderNumber });
      window.location.assign(paymentUrl);
    },
    onError: (error) => {
      if (active.current) {
        setNoticeKind('error');
        setNotice(errorText(error));
        invalidate();
      }
    },
    onSettled: () => {
      if (active.current) actionLock.current = false;
    },
  });

  if (!validId)
    return (
      <section className="account-page">
        <AccountNav />
        <h1>جزئیات سفارش</h1>
        <p role="alert">شناسهٔ سفارش معتبر نیست.</p>
        <Link to="/orders">بازگشت به سفارش‌ها</Link>
      </section>
    );
  if (order.isLoading || order.error)
    return (
      <section className="account-page account-detail-page">
        <AccountNav />
        <h1>جزئیات سفارش</h1>
        <Link to="/orders">بازگشت به سفارش‌ها</Link>
        {order.isLoading ? (
          <LoadingState layout="detail" />
        ) : (
          <ErrorState error={order.error} onRetry={() => void order.refetch()} />
        )}
      </section>
    );
  if (!order.data || order.data.userId !== userId || order.data.id !== orderId) return null;

  const detail = order.data;
  const snapshot = detail.addressSnapshot;
  const latestPayment = detail.payments[0];
  const busy = cancel.isPending || startPayment.isPending;
  const paymentDeadline =
    detail.expiresAt && Number.isFinite(Date.parse(detail.expiresAt)) ? detail.expiresAt : null;

  async function runAction(kind: 'cancel' | 'pay') {
    if (
      !active.current ||
      actionLock.current ||
      order.isFetching ||
      detail.status !== 'PENDING_PAYMENT'
    ) {
      if (kind === 'cancel') throw new Error('وضعیت سفارش تغییر کرده است. پیش از لغو دوباره آن را بررسی کنید.');
      return;
    }
    actionLock.current = true;
    setNotice(null);
    try {
      if (kind === 'cancel') await cancel.mutateAsync();
      else await startPayment.mutateAsync();
    } catch (error) {
      // Confirmation owns cancellation errors; ordinary payment feedback stays inline.
      if (kind === 'cancel') throw error;
    }
  }

  return (
    <article className="account-page account-detail-page">
      <AccountNav />
      <header className="account-heading">
        <div>
          <h1>جزئیات سفارش</h1>
          <p>
            <bdi>{detail.orderNumber}</bdi>
          </p>
        </div>
        <span className="account-badge" data-status={detail.status}>
          {ORDER_STATUS_FA[detail.status]}
        </span>
      </header>
      <p className="account-subtle">
        {formatJalali(detail.createdAt, 'datetime')}
      </p>

      {detail.status === 'PENDING_PAYMENT' && (
        <>
          <p role="note">
            {paymentDeadline
              ? `مهلت پرداخت طبق تنظیم فعلی سامانه: ${formatJalali(paymentDeadline, 'datetime')}. وضعیت نهایی را بررسی کنید.`
              : 'این سفارش در انتظار پرداخت است. مهلت و امکان پرداخت را سامانه تعیین می‌کند؛ سفارش پرداخت‌نشده ممکن است منقضی شود.'}
          </p>
          <button
            type="button"
            disabled={busy || order.isFetching}
            onClick={() => void order.refetch()}
          >
            {order.isFetching ? 'در حال بررسی وضعیت…' : 'بررسی وضعیت سفارش'}
          </button>
          <div className="account-actions">
            <button
              className="account-submit"
              type="button"
              disabled={busy || order.isFetching}
              onClick={() => void runAction('pay')}
            >
              پرداخت
            </button>
            <button
              className="account-danger"
              type="button"
              disabled={busy || order.isFetching}
              onClick={() => {
                if (!actionLock.current && !order.isFetching) setCancelOpen(true);
              }}
            >
              لغو سفارش
            </button>
          </div>
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
        <ul className="account-order-items">
          {detail.items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.productName}</strong>
                <span className="account-subtle">
                  {formatWeight(item.weightGram)} · {item.quantity} عدد
                </span>
              </div>
              <strong>
                <bdi>{formatToman(item.total)}</bdi>
              </strong>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>نشانی تحویل</h2>
        {snapshot ? (
          <>
            <p>
              {snapshot.receiverName} — {snapshot.title}
            </p>
            <p dir="ltr">{snapshot.receiverPhone}</p>
            <p>
              {snapshot.province}، {snapshot.city}، {snapshot.fullAddress}
            </p>
            {snapshot.postalCode && <p dir="ltr">{snapshot.postalCode}</p>}
          </>
        ) : (
          <p role="status">
            نشانی این سفارش قابل نمایش نیست. برای بررسی، شمارهٔ سفارش را به پشتیبانی اعلام کنید.
          </p>
        )}
      </section>

      <section>
        <h2>خلاصه سفارش</h2>
        <dl className="account-totals">
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

      {notice && <p role={noticeKind === 'error' ? 'alert' : 'status'}>{notice}</p>}

      <p>
        <Link to="/orders">بازگشت به سفارش‌ها</Link>
      </p>
      <ConfirmDialog
        open={cancelOpen}
        title="لغو سفارش"
        description={`سفارش «${detail.orderNumber}» لغو می‌شود. این کار قابل بازگشت نیست.`}
        confirmLabel="لغو این سفارش"
        pending={busy}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => runAction('cancel')}
      />
    </article>
  );
}
