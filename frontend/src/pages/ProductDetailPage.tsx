import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { useAuth } from '../auth/auth-provider';
import { ErrorState, LoadingState } from '../components/states';
import { MAX_CART_ITEM_QTY } from '../lib/constants';
import { formatToman, formatWeight } from '../lib/format';
import { errorText } from '../lib/labels';
import { safeImageUrl } from '../lib/image-url';
import { API_BASE_URL } from '../lib/env';

/** Product detail: variant selection, add-to-cart and favorite toggle (F5/F7/F8 behaviour). */
export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { status, user } = useAuth();
  const isAuthenticated = status === 'authed';
  const identity = isAuthenticated ? user?.id ?? null : null;
  const queryClient = useQueryClient();

  const product = useQuery({
    queryKey: queryKeys.product(slug),
    queryFn: () => shopApi.product(slug),
    enabled: slug.length > 0,
  });

  const favorites = useQuery({
    queryKey: queryKeys.favorites(1),
    queryFn: async ({ signal }) => {
      const generation = generationRef.current;
      const result = await shopApi.favorites(1, 50);
      if (signal.aborted || !mountedRef.current || identityRef.current !== identity ||
        generationRef.current !== generation) throw new DOMException('Inactive session', 'AbortError');
      return result;
    },
    enabled: identity !== null,
  });

  const [variantId, setVariantId] = useState<number | null>(null);
  const [quantityInput, setQuantityInput] = useState('1');
  const [message, setMessage] = useState<string | null>(null);
  const [addPending, setAddPending] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const mountedRef = useRef(true);
  const identityRef = useRef(identity);
  const slugRef = useRef(slug);
  const generationRef = useRef(0);
  const addInFlightRef = useRef(false);
  const favoriteInFlightRef = useRef(false);
  const quantity = Number(quantityInput);
  const validQuantity =
    /^[0-9]+$/.test(quantityInput) &&
    Number.isSafeInteger(quantity) &&
    quantity >= 1 &&
    quantity <= MAX_CART_ITEM_QTY;

  useLayoutEffect(() => {
    if (identityRef.current === identity && slugRef.current === slug) return;
    identityRef.current = identity;
    slugRef.current = slug;
    generationRef.current += 1;
    addInFlightRef.current = false;
    favoriteInFlightRef.current = false;
    setAddPending(false);
    setFavoritePending(false);
    setMessage(null);
  }, [identity, slug]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };
  }, []);

  const activeVariant = useMemo(
    () =>
      product.data?.variants.find((variant) => variant.id === variantId) ??
      product.data?.variants[0] ??
      null,
    [product.data, variantId],
  );

  const addToCart = useMutation({
    mutationFn: ({ variantId, count }: { variantId: number; count: number }) =>
      shopApi.addCartItem(variantId, count),
  });

  const isFavorite =
    product.data !== undefined &&
    (favorites.data?.data.some((card) => card.id === product.data.id) ?? false);

  const toggleFavorite = useMutation({
    mutationFn: ({ productId, remove }: { productId: number; remove: boolean }) =>
      remove ? shopApi.removeFavorite(productId) : shopApi.addFavorite(productId),
  });

  function responseIsCurrent(requestIdentity: number, requestSlug: string, generation: number) {
    return mountedRef.current && identityRef.current === requestIdentity &&
      slugRef.current === requestSlug && generationRef.current === generation;
  }

  function submitAddToCart(event: FormEvent) {
    event.preventDefault();
    if (!mountedRef.current || addInFlightRef.current || identityRef.current === null || !activeVariant?.inStock ||
      !validQuantity) return;
    const requestIdentity = identityRef.current;
    const requestSlug = slugRef.current;
    const generation = generationRef.current;
    addInFlightRef.current = true;
    setAddPending(true);
    setMessage(null);
    void addToCart.mutateAsync({ variantId: activeVariant.id, count: quantity })
      .then(() => {
        if (!responseIsCurrent(requestIdentity, requestSlug, generation)) return;
        setMessage('به سبد خرید اضافه شد.');
        void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      })
      .catch((error: unknown) => {
        if (responseIsCurrent(requestIdentity, requestSlug, generation)) setMessage(errorText(error));
      })
      .finally(() => {
        if (!responseIsCurrent(requestIdentity, requestSlug, generation)) return;
        addInFlightRef.current = false;
        setAddPending(false);
      });
  }

  function submitFavorite() {
    if (!mountedRef.current || favoriteInFlightRef.current || identityRef.current === null || !product.data) return;
    const requestIdentity = identityRef.current;
    const requestSlug = slugRef.current;
    const generation = generationRef.current;
    favoriteInFlightRef.current = true;
    setFavoritePending(true);
    setMessage(null);
    void toggleFavorite.mutateAsync({ productId: product.data.id, remove: isFavorite })
      .then(() => {
        if (responseIsCurrent(requestIdentity, requestSlug, generation))
          void queryClient.invalidateQueries({ queryKey: ['favorites'] });
      })
      .catch((error: unknown) => {
        if (responseIsCurrent(requestIdentity, requestSlug, generation)) setMessage(errorText(error));
      })
      .finally(() => {
        if (!responseIsCurrent(requestIdentity, requestSlug, generation)) return;
        favoriteInFlightRef.current = false;
        setFavoritePending(false);
      });
  }

  if (product.isLoading) return <LoadingState />;
  if (product.error)
    return <ErrorState error={product.error} onRetry={() => void product.refetch()} />;
  if (!product.data) return <ErrorState error="محصول یافت نشد" />;

  const detail = product.data;
  const leadImage = [...detail.images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const imageUrl = safeImageUrl(leadImage?.url, window.location.origin, API_BASE_URL);

  return (
    <article className="product-detail">
      <nav className="product-detail__breadcrumb" aria-label="مسیر">
        <Link to="/">خانه</Link> / <Link to="/products">محصولات</Link> / {detail.name}
      </nav>
      <div className="product-detail__main">
        <div className="product-detail__media">
          {imageUrl ? (
            <img src={imageUrl} alt={detail.name} referrerPolicy="no-referrer" />
          ) : (
            <span className="product-detail__placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="product-detail__info">
          <p className="product-detail__eyebrow">
            {detail.brand.name} / {detail.category.name}
          </p>
          <h1>{detail.name}</h1>
          <p>
            {detail.petType.name} · {detail.brand.name} · {detail.category.name}
          </p>
          <form onSubmit={submitAddToCart}>
            <fieldset>
              <legend>وزن</legend>
              {detail.variants.map((variant) => (
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
              step={1}
              dir="ltr"
              value={quantityInput}
              aria-invalid={!validQuantity}
              aria-describedby={!validQuantity ? 'qty-error' : undefined}
              onChange={(event) => setQuantityInput(event.target.value)}
            />
            {!validQuantity && <p id="qty-error" role="alert">تعداد باید عدد صحیح بین ۱ تا {MAX_CART_ITEM_QTY} باشد.</p>}

            <button
              type="submit"
              disabled={identity === null || !activeVariant?.inStock || !validQuantity || addPending}
            >
              {addPending ? 'در حال افزودن…' : 'افزودن به سبد خرید'}
            </button>
            {identity === null && (
              <Link to={`/login?next=${encodeURIComponent(`/products/${detail.slug}`)}`}>
                برای افزودن به سبد خرید وارد شوید
              </Link>
            )}

            {identity !== null ? (
              <button
                type="button"
                disabled={favoritePending}
                onClick={submitFavorite}
              >
                {isFavorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
              </button>
            ) : (
              <Link to={`/login?next=${encodeURIComponent(`/products/${detail.slug}`)}`}>
                برای ذخیره وارد شوید
              </Link>
            )}
          </form>
          {message && <p role="status">{message}</p>}
        </div>
      </div>

      <section className="product-detail__description">
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
