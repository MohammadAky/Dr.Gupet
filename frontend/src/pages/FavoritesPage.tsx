import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { useAuth } from '../auth/auth-provider';
import { Pagination } from '../components/Pagination';
import { ProductCardView } from '../components/ProductCardView';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { errorText } from '../lib/labels';
import { AccountFrame, AccountNav } from '../components/AccountNav';

/** Favorites list (F7) — remove is idempotent on the server. */
export function FavoritesPage() {
  const { status, user } = useAuth();
  const userId = status === 'authed' ? (user?.id ?? null) : null;
  if (status === 'loading') return <AccountFrame title="علاقه‌مندی‌ها"><LoadingState /></AccountFrame>;
  if (userId === null) return <p>برای مشاهدهٔ علاقه‌مندی‌ها وارد حساب شوید.</p>;
  return <FavoritesContent key={userId} />;
}

function FavoritesContent() {
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1;
  const queryClient = useQueryClient();
  const active = useRef(true);
  const writing = useRef(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [removed, setRemoved] = useState<{ id: number; name: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const favorites = useQuery({
    queryKey: queryKeys.favorites(page),
    queryFn: async ({ signal }) => {
      const result = await shopApi.favorites(page);
      if (signal.aborted || !active.current)
        throw new DOMException('Inactive session', 'AbortError');
      return result;
    },
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (productId: number) => shopApi.removeFavorite(productId),
  });

  async function removeFavorite(productId: number, name: string) {
    if (!active.current || writing.current || favorites.isFetching) return;
    writing.current = true;
    setPendingId(productId);
    setNotice(null);
    try {
      await remove.mutateAsync(productId);
      if (!active.current) return;
      await queryClient.invalidateQueries({ queryKey: ['favorites'] });
      if (active.current) {
        setNotice({ kind: 'success', text: 'محصول از علاقه‌مندی‌ها حذف شد.' });
        setRemoved({ id: productId, name });
        heading.current?.focus();
      }
    } catch (error) {
      if (active.current) setNotice({ kind: 'error', text: errorText(error) });
    } finally {
      if (active.current) {
        writing.current = false;
        setPendingId(null);
      }
    }
  }

  async function undo() {
    if (!removed || !active.current || writing.current || favorites.isFetching) return;
    writing.current = true;
    setPendingId(removed.id);
    try {
      await shopApi.addFavorite(removed.id);
      if (!active.current) return;
      await queryClient.invalidateQueries({ queryKey: ['favorites'] });
      if (active.current) { setNotice({ kind: 'success', text: `«${removed.name}» به علاقه‌مندی‌ها برگشت.` }); setRemoved(null); }
    } catch (error) {
      if (active.current) setNotice({ kind: 'error', text: errorText(error) });
    } finally {
      if (active.current) { writing.current = false; setPendingId(null); }
    }
  }

  if (favorites.isLoading) return <AccountFrame title="علاقه‌مندی‌ها"><LoadingState /></AccountFrame>;
  if (favorites.error)
    return <AccountFrame title="علاقه‌مندی‌ها"><ErrorState error={favorites.error} onRetry={() => void favorites.refetch()} /></AccountFrame>;

  const items = favorites.data?.data ?? [];

  return (
    <section className="account-page" aria-busy={pendingId !== null || favorites.isFetching}>
      <AccountNav />
      <header className="account-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>علاقه‌مندی‌ها</h1>
          <p>انتخاب‌های شما، برای وقتی که دوباره سراغشان می‌آیید.</p>
        </div>
        <Link className="account-secondary-link" to="/products">
          کشف محصولات
        </Link>
      </header>
      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
      {removed && <div className="account-feedback">«{removed.name}» حذف شد.
        <button type="button" disabled={pendingId !== null || favorites.isFetching} onClick={() => void undo()}>بازگردانی</button>
      </div>}
      {favorites.isFetching && <p role="status">در حال دریافت علاقه‌مندی‌ها…</p>}

      {items.length === 0 && (
        <EmptyState
          text="هنوز محصولی را ذخیره نکرده‌اید."
          action={<Link to="/products">مشاهدهٔ محصولات</Link>}
        />
      )}

      <div className="product-grid">
        {items.map((card) => (
          <ProductCardView
            key={card.id}
            card={card}
            actions={
              <button
                type="button"
                disabled={pendingId !== null || favorites.isFetching}
                aria-label={`حذف ${card.name} از علاقه‌مندی‌ها`}
                onClick={() => void removeFavorite(card.id, card.name)}
              >
                حذف
              </button>
            }
          />
        ))}
      </div>

      <Pagination meta={favorites.data?.meta} busy={favorites.isFetching} />
      {page > 1 && favorites.data && favorites.data.data.length === 0 && (
        <button type="button" onClick={() => setParams(new URLSearchParams())}>
          بازگشت به صفحهٔ اول
        </button>
      )}
    </section>
  );
}
