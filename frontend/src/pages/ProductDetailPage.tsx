import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { useAuth } from '../auth/auth-provider';
import { ErrorState, LoadingState } from '../components/states';
import { MAX_CART_ITEM_QTY } from '../lib/constants';
import { formatToman, formatWeight } from '../lib/format';
import { errorText } from '../lib/labels';

/** Product detail: variant selection, add-to-cart and favorite toggle (F5/F7/F8 behaviour). */
export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { status } = useAuth();
  const isAuthenticated = status === 'authed';
  const queryClient = useQueryClient();

  const product = useQuery({
    queryKey: queryKeys.product(slug),
    queryFn: () => shopApi.product(slug),
    enabled: slug.length > 0,
  });

  const favorites = useQuery({
    queryKey: queryKeys.favorites(1),
    queryFn: () => shopApi.favorites(1, 50),
    enabled: isAuthenticated,
  });

  const [variantId, setVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  const variants = product.data?.variants ?? [];
  const activeVariant = useMemo(
    () => variants.find((variant) => variant.id === variantId) ?? variants[0] ?? null,
    [variants, variantId],
  );

  const addToCart = useMutation({
    mutationFn: () => {
      if (!activeVariant) throw new Error('یک وزن انتخاب کنید');
      return shopApi.addCartItem(activeVariant.id, quantity);
    },
    onSuccess: () => {
      setMessage('به سبد خرید اضافه شد.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
    },
    onError: (error) => setMessage(errorText(error)),
  });

  const isFavorite =
    product.data !== undefined && (favorites.data?.data.some((card) => card.id === product.data.id) ?? false);

  const toggleFavorite = useMutation({
    mutationFn: () => {
      if (!product.data) throw new Error('محصول بارگذاری نشده است');
      return isFavorite ? shopApi.removeFavorite(product.data.id) : shopApi.addFavorite(product.data.id);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['favorites'] }),
    onError: (error) => setMessage(errorText(error)),
  });

  if (product.isLoading) return <LoadingState />;
  if (product.error) return <ErrorState error={product.error} onRetry={() => void product.refetch()} />;
  if (!product.data) return <ErrorState error="محصول یافت نشد" />;

  const detail = product.data;

  function submitAddToCart(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    addToCart.mutate();
  }

  return (
    <article>
      <nav aria-label="مسیر">
        <Link to="/">خانه</Link> / <Link to="/products">محصولات</Link> / {detail.name}
      </nav>

      <h1>{detail.name}</h1>
      <p>
        {detail.brand.name} · {detail.category.name} · {detail.petType.name}
      </p>

      <form onSubmit={submitAddToCart}>
        <fieldset>
          <legend>وزن</legend>
          {variants.map((variant) => (
            <label key={variant.id}>
              <input
                type="radio"
                name="variant"
                value={variant.id}
                checked={activeVariant?.id === variant.id}
                onChange={() => setVariantId(variant.id)}
              />
              {formatWeight(variant.weightGram)} — {formatToman(variant.price)}{' '}
              {variant.inStock ? '(موجود)' : '(ناموجود)'}
              {variant.compareAtPrice ? ` [تا ${formatToman(variant.compareAtPrice)}]` : ''}
              {variant.lowStock ? ' (موجودی محدود)' : ''}
            </label>
          ))}
        </fieldset>

        <label htmlFor="qty">تعداد</label>
        <input
          id="qty"
          type="number"
          min={1}
          max={MAX_CART_ITEM_QTY}
          dir="ltr"
          value={quantity}
          onChange={(event) => {
            const next = Number(event.target.value);
            setQuantity(Number.isFinite(next) ? Math.min(Math.max(next, 1), MAX_CART_ITEM_QTY) : 1);
          }}
        />

        <button type="submit" disabled={!activeVariant || !activeVariant.inStock || addToCart.isPending}>
          {addToCart.isPending ? 'در حال افزودن…' : 'افزودن به سبد خرید'}
        </button>

        {isAuthenticated ? (
          <button type="button" disabled={toggleFavorite.isPending} onClick={() => toggleFavorite.mutate()}>
            {isFavorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
          </button>
        ) : (
          <Link to={`/login?next=${encodeURIComponent(`/products/${detail.slug}`)}`}>برای ذخیره وارد شوید</Link>
        )}
      </form>

      {message && <p role="status">{message}</p>}

      <section>
        <h2>توضیحات</h2>
        <p>{detail.description ?? '—'}</p>
        <h2>ترکیبات</h2>
        <p>{detail.ingredientsText ?? '—'}</p>
        <h2>برچسب‌ها</h2>
        <ul>
          {detail.tags.map((tag) => (
            <li key={tag.id}>{tag.name}</li>
          ))}
        </ul>
        <p>
          <Link to={`/recommendations?petId=`}>محصولات مناسب پت من</Link>
        </p>
      </section>
    </article>
  );
}
