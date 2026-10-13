import { useQuery } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { useLayoutEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { formatJalali } from '../lib/jalali';
import { formatToman, toFaDigits } from '../lib/format';
import { ORDER_STATUS_FA } from '../lib/labels';
import { AccountFrame, AccountNav } from '../components/AccountNav';
import { useAuth } from '../auth/auth-provider';

/** Orders list (F9): newest first, page-based. */
export function OrdersPage() {
  const { status, user } = useAuth();
  if (status === 'loading') return <AccountFrame title="سفارش‌های من"><LoadingState layout="rows" /></AccountFrame>;
  if (status !== 'authed' || !user) return <p>برای دیدن سفارش‌ها وارد حساب شوید.</p>;
  return <OrdersSession key={user.id} />;
}

function OrdersSession() {
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1;
  const active = useRef(true);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const orders = useQuery({
    queryKey: queryKeys.orders(page),
    queryFn: async ({ signal }) => {
      const result = await shopApi.orders(page);
      if (signal.aborted || !active.current)
        throw new DOMException('Inactive session', 'AbortError');
      return result;
    },
    placeholderData: keepPreviousData,
  });

  if (orders.isLoading) return <AccountFrame title="سفارش‌های من"><LoadingState layout="rows" /></AccountFrame>;
  if (orders.error)
    return <AccountFrame title="سفارش‌های من"><ErrorState error={orders.error} onRetry={() => void orders.refetch()} /></AccountFrame>;

  const items = orders.data?.data ?? [];

  return (
    <section className="account-page" aria-busy={orders.isFetching}>
      <AccountNav />
      <header className="account-heading">
        <div>
          <h1>سفارش‌های من</h1>
          <p>از ثبت تا تحویل؛ وضعیت هر سفارش را همین‌جا دنبال کنید.</p>
        </div>
      </header>

      {items.length === 0 && (
        <EmptyState
          text={page > 1 ? 'در این صفحه سفارشی پیدا نشد.' : 'هنوز سفارشی ثبت نکرده‌اید.'}
          action={page > 1 ? <button type="button" disabled={orders.isFetching} onClick={() => {
            const query = new URLSearchParams(params);
            query.delete('page');
            setParams(query);
          }}>بازگشت به صفحهٔ اول</button> : <Link to="/products">شروع خرید</Link>}
        />
      )}

      {orders.isFetching && <p role="status">در حال دریافت سفارش‌ها…</p>}
      <ul className="account-list account-orders" aria-label="سفارش‌ها">
        {items.map((order) => (
          <li key={order.id}>
            <div className="account-order-identity">
              <strong>
                <bdi>{order.orderNumber}</bdi>
              </strong>
              <span className="account-badge" data-status={order.status}>
                {ORDER_STATUS_FA[order.status]}
              </span>
            </div>
            <p className="account-subtle">{formatJalali(order.createdAt, 'datetime')}</p>
            <p className="account-order-amount">{formatToman(order.finalAmount)}</p>
            <p className="account-actions">
              {toFaDigits(String(order.items.length))} قلم · <Link to={`/orders/${order.id}`}>جزئیات</Link>
            </p>
          </li>
        ))}
      </ul>

      <Pagination meta={orders.data?.meta} busy={orders.isFetching} />
    </section>
  );
}
