import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { Pagination } from '../components/Pagination';
import { ProductCardView } from '../components/ProductCardView';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { errorText } from '../lib/labels';

/** Favorites list (F7) — remove is idempotent on the server. */
export function FavoritesPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const queryClient = useQueryClient();

  const favorites = useQuery({
    queryKey: queryKeys.favorites(page),
    queryFn: () => shopApi.favorites(page),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (productId: number) => shopApi.removeFavorite(productId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['favorites'] }),
    onError: (error) => alert(errorText(error)),
  });

  if (favorites.isLoading) return <LoadingState />;
  if (favorites.error)
    return <ErrorState error={favorites.error} onRetry={() => void favorites.refetch()} />;

  const items = favorites.data?.data ?? [];

  return (
    <section>
      <h1>علاقه‌مندی‌ها</h1>

      {items.length === 0 && <EmptyState text="هنوز محصولی را ذخیره نکرده‌اید." />}

      <div className="product-grid">
        {items.map((card) => (
          <ProductCardView
            key={card.id}
            card={card}
            actions={
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate(card.id)}
              >
                حذف
              </button>
            }
          />
        ))}
      </div>

      <Pagination meta={favorites.data?.meta} />
      {page > 1 && favorites.data && favorites.data.data.length === 0 && (
        <button type="button" onClick={() => setParams(new URLSearchParams())}>
          بازگشت به صفحهٔ اول
        </button>
      )}
    </section>
  );
}
