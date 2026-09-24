import { useQuery } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { formatJalali } from '../lib/jalali';
import { formatToman } from '../lib/format';
import { ORDER_STATUS_FA } from '../lib/labels';

/** Orders list (F9): newest first, page-based. */
export function OrdersPage() {
  const [params] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  const orders = useQuery({
    queryKey: queryKeys.orders(page),
    queryFn: () => shopApi.orders(page),
    placeholderData: keepPreviousData,
  });

  if (orders.isLoading) return <LoadingState />;
  if (orders.error) return <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />;

  const items = orders.data?.data ?? [];

  return (
    <section>
      <h1>سفارش‌های من</h1>

      {items.length === 0 && (
        <EmptyState text="هنوز سفارشی ثبت نکرده‌اید." action={<Link to="/products">شروع خرید</Link>} />
      )}

      <ul>
        {items.map((order) => (
          <li key={order.id}>
            <p dir="ltr">{order.orderNumber}</p>
            <p>{formatJalali(order.createdAt, 'datetime')}</p>
            <p>{ORDER_STATUS_FA[order.status]}</p>
            <p dir="ltr">{formatToman(order.finalAmount)}</p>
            <p>
              {order.items.length} قلم ·{' '}
              <Link to={`/orders/${order.id}`}>جزئیات</Link>
            </p>
          </li>
        ))}
      </ul>

      <Pagination meta={orders.data?.meta} />
    </section>
  );
}
