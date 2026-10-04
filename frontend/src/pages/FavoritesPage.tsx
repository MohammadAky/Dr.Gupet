import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { useAuth } from '../auth/auth-provider';
import { Pagination } from '../components/Pagination';
import { ProductCardView } from '../components/ProductCardView';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { errorText } from '../lib/labels';

/** Favorites list (F7) — remove is idempotent on the server. */
export function FavoritesPage() {
  const { status, user } = useAuth();
  const userId = status === 'authed' ? user?.id ?? null : null;
  if (userId === null) return <p>برای مشاهدهٔ علاقه‌مندی‌ها وارد حساب شوید.</p>;
  return <FavoritesContent key={userId} />;
}

function FavoritesContent() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const queryClient = useQueryClient();
  const active = useRef(true);
  const writing = useRef(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useLayoutEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const favorites = useQuery({
    queryKey: queryKeys.favorites(page),
    queryFn: async ({ signal }) => {
      const result = await shopApi.favorites(page);
      if (signal.aborted || !active.current) throw new DOMException('Inactive session', 'AbortError');
      return result;
    },
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (productId: number) => shopApi.removeFavorite(productId),
  });

  async function removeFavorite(productId: number) {
    if (!active.current || writing.current) return;
    writing.current = true;
    setPendingId(productId);
    setNotice(null);
    try {
      await remove.mutateAsync(productId);
      if (!active.current) return;
      await queryClient.invalidateQueries({ queryKey: ['favorites'] });
      if (active.current) setNotice({ kind: 'success', text: 'محصول از علاقه‌مندی‌ها حذف شد.' });
    } catch (error) {
      if (active.current) setNotice({ kind: 'error', text: errorText(error) });
    } finally {
      if (active.current) {
        writing.current = false;
        setPendingId(null);
      }
    }
  }

  if (favorites.isLoading) return <LoadingState />;
  if (favorites.error)
    return <ErrorState error={favorites.error} onRetry={() => void favorites.refetch()} />;

  const items = favorites.data?.data ?? [];

  return (
    <section aria-busy={pendingId !== null}>
      <h1>علاقه‌مندی‌ها</h1>
      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

      {items.length === 0 && <EmptyState text="هنوز محصولی را ذخیره نکرده‌اید." />}

      <div className="product-grid">
        {items.map((card) => (
          <ProductCardView
            key={card.id}
            card={card}
            actions={
              <button
                type="button"
                disabled={pendingId !== null}
                onClick={() => void removeFavorite(card.id)}
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
