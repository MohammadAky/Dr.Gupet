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
import { SafeImage } from '../components/SafeImage';
import { Dialog } from '../components/ui/interactive';
import { isSampleProduct } from '../lib/sample-records';
import { SampleRecordNotice } from '../components/SampleRecordNotice';

/** Product detail: variant selection, add-to-cart and favorite toggle (F5/F7/F8 behaviour). */
export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { status, user } = useAuth();
  const isAuthenticated = status === 'authed';
  const identity = isAuthenticated ? (user?.id ?? null) : null;
  const queryClient = useQueryClient();

  const product = useQuery({
    queryKey: queryKeys.product(slug),
    queryFn: () => shopApi.product(slug),
    enabled: slug.length > 0,
  });

  const favorites = useQuery({
    queryKey: ['favorites', 'membership', product.data?.id],
    queryFn: async ({ signal }) => {
      const generation = generationRef.current;
      for (let page = 1; ; page += 1) {
        const result = await shopApi.favorites(page, 50);
        if (
          signal.aborted ||
          !mountedRef.current ||
          identityRef.current !== identity ||
          generationRef.current !== generation
        )
          throw new DOMException('Inactive session', 'AbortError');
        if (result.data.some((card) => card.id === product.data?.id)) return true;
        if (!result.meta || page >= result.meta.totalPages) return false;
      }
    },
    enabled: identity !== null && product.data !== undefined,
  });

  const [variantId, setVariantId] = useState<number | null>(null);
  const [quantityInput, setQuantityInput] = useState('1');
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [addPending, setAddPending] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
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
    setSelectedImageId(null);
    setGalleryOpen(false);
    setVariantId(null);
    setQuantityInput('1');
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
      product.data?.variants.find((variant) => variant.inStock) ??
      product.data?.variants[0] ??
      null,
    [product.data, variantId],
  );

  const addToCart = useMutation({
    mutationFn: ({ variantId, count }: { variantId: number; count: number }) =>
      shopApi.addCartItem(variantId, count),
  });

  const isFavorite = favorites.data === true;

  const toggleFavorite = useMutation({
    mutationFn: ({ productId, remove }: { productId: number; remove: boolean }) =>
      remove ? shopApi.removeFavorite(productId) : shopApi.addFavorite(productId),
  });

  function responseIsCurrent(requestIdentity: number, requestSlug: string, generation: number) {
    return (
      mountedRef.current &&
      identityRef.current === requestIdentity &&
      slugRef.current === requestSlug &&
      generationRef.current === generation
    );
  }

  function submitAddToCart(event: FormEvent) {
    event.preventDefault();
    if (
      !mountedRef.current ||
      addInFlightRef.current ||
      identityRef.current === null ||
      (product.data && isSampleProduct(product.data)) ||
      !activeVariant?.inStock ||
      !validQuantity
    )
      return;
    const requestIdentity = identityRef.current;
    const requestSlug = slugRef.current;
    const generation = generationRef.current;
    addInFlightRef.current = true;
    setAddPending(true);
    setMessage(null);
    void addToCart
      .mutateAsync({ variantId: activeVariant.id, count: quantity })
      .then(() => {
        if (!responseIsCurrent(requestIdentity, requestSlug, generation)) return;
        setMessageKind('success');
        setMessage('به سبد خرید اضافه شد.');
        void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      })
      .catch((error: unknown) => {
        if (responseIsCurrent(requestIdentity, requestSlug, generation)) {
          setMessageKind('error');
          setMessage(errorText(error));
        }
      })
      .finally(() => {
        if (!responseIsCurrent(requestIdentity, requestSlug, generation)) return;
        addInFlightRef.current = false;
        setAddPending(false);
      });
  }

  function submitFavorite() {
    if (
      !mountedRef.current ||
      favoriteInFlightRef.current ||
      identityRef.current === null ||
      !product.data ||
      !favorites.isSuccess ||
      favorites.isFetching
    )
      return;
    const requestIdentity = identityRef.current;
    const requestSlug = slugRef.current;
    const generation = generationRef.current;
    favoriteInFlightRef.current = true;
    setFavoritePending(true);
    setMessage(null);
    void toggleFavorite
      .mutateAsync({ productId: product.data.id, remove: isFavorite })
      .then(() => {
        if (responseIsCurrent(requestIdentity, requestSlug, generation)) {
          setMessageKind('success');
          setMessage(
            isFavorite ? 'محصول از علاقه‌مندی‌ها حذف شد.' : 'محصول در علاقه‌مندی‌ها ذخیره شد.',
          );
          void queryClient.invalidateQueries({ queryKey: ['favorites'] });
        }
      })
      .catch((error: unknown) => {
        if (responseIsCurrent(requestIdentity, requestSlug, generation)) {
          setMessageKind('error');
          setMessage(errorText(error));
        }
      })
      .finally(() => {
        if (!responseIsCurrent(requestIdentity, requestSlug, generation)) return;
        favoriteInFlightRef.current = false;
        setFavoritePending(false);
      });
  }

  if (product.isLoading || product.error || !product.data)
    return (
      <section className="product-detail">
        <nav aria-label="مسیر">
          <Link to="/products">بازگشت به محصولات</Link>
        </nav>
        <h1>{product.data?.name ?? 'اطلاعات محصول'}</h1>
        {product.isLoading ? (
          <LoadingState />
        ) : (
          <ErrorState
            error={product.error ?? 'محصول یافت نشد'}
            onRetry={() => void product.refetch()}
          />
        )}
      </section>
    );

  const detail = product.data;
  const images = [...detail.images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image) => ({
      ...image,
      safeUrl: safeImageUrl(image.url, window.location.origin, API_BASE_URL),
    }))
    .filter((image) => image.safeUrl);
  const selectedImage = images.find((image) => image.id === selectedImageId) ?? images[0];
  const imageUrl = selectedImage?.safeUrl;

  return (
    <article className="product-detail">
      <nav className="product-detail__breadcrumb" aria-label="مسیر">
        <Link to="/">خانه</Link> / <Link to="/products">محصولات</Link> / {detail.name}
      </nav>
      <div className="product-detail__main">
        <div className="product-detail__gallery">
          <div className="product-detail__media">
            {imageUrl ? (
              <button
                className="commerce-gallery-open"
                type="button"
                onClick={() => setGalleryOpen(true)}
                aria-label={`نمایش بزرگ‌تر تصویر ${detail.name}`}
              >
                <SafeImage src={imageUrl} alt={detail.name} referrerPolicy="no-referrer" />
                <span>نمایش بزرگ‌تر</span>
              </button>
            ) : (
              <span className="product-detail__placeholder" aria-hidden="true" />
            )}
          </div>
          {images.length > 1 && (
            <div className="product-detail__thumbnails" role="group" aria-label="تصاویر محصول">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={`تصویر ${index + 1} از ${detail.name}`}
                  aria-pressed={selectedImage?.id === image.id}
                  onClick={() => setSelectedImageId(image.id)}
                >
                  <SafeImage
                    src={image.safeUrl!}
                    alt=""
                    width="72"
                    height="72"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-detail__info">
          <p className="product-detail__eyebrow">
            {detail.brand.name} / {detail.category.name}
          </p>
          <h1>{detail.name}</h1>
          {isSampleProduct(detail) && <SampleRecordNotice kind="product" />}
          <p>
            {detail.petType.name} · {detail.brand.name} · {detail.category.name}
          </p>
          <form onSubmit={submitAddToCart}>
            {activeVariant && (
              <div className="commerce-product-price">
                <strong>{formatToman(activeVariant.price)}</strong>
                {activeVariant.compareAtPrice &&
                activeVariant.compareAtPrice > activeVariant.price ? (
                  <del aria-label="قیمت پیشین">{formatToman(activeVariant.compareAtPrice)}</del>
                ) : null}
              </div>
            )}
            <fieldset className="commerce-variants">
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
                  <span>
                    <strong>{formatWeight(variant.weightGram)}</strong>
                    <span>{formatToman(variant.price)}</span>
                  </span>
                  <span className="commerce-variant-stock">
                    {variant.inStock ? (variant.lowStock ? 'موجودی محدود' : 'موجود') : 'ناموجود'}
                  </span>
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
            {!validQuantity && (
              <p id="qty-error" role="alert">
                تعداد باید عدد صحیح بین ۱ تا {MAX_CART_ITEM_QTY} باشد.
              </p>
            )}

            <button
              type="submit"
              disabled={
                isSampleProduct(detail) ||
                identity === null ||
                !activeVariant?.inStock ||
                !validQuantity ||
                addPending
              }
            >
              {addPending ? 'در حال افزودن…' : 'افزودن به سبد خرید'}
            </button>
            {identity === null && !isSampleProduct(detail) && (
              <Link to={`/login?next=${encodeURIComponent(`/products/${detail.slug}`)}`}>
                برای افزودن به سبد خرید وارد شوید
              </Link>
            )}

            {identity !== null ? (
              <button
                type="button"
                aria-pressed={isFavorite}
                disabled={favoritePending || !favorites.isSuccess || favorites.isFetching}
                onClick={submitFavorite}
              >
                {favoritePending
                  ? 'در حال ذخیره…'
                  : isFavorite
                    ? 'حذف از علاقه‌مندی‌ها'
                    : 'افزودن به علاقه‌مندی‌ها'}
              </button>
            ) : (
              <Link to={`/login?next=${encodeURIComponent(`/products/${detail.slug}`)}`}>
                برای ذخیره وارد شوید
              </Link>
            )}
          </form>
          {identity !== null && favorites.isLoading && (
            <LoadingState text="در حال بررسی علاقه‌مندی‌ها…" />
          )}
          {identity !== null && favorites.error && (
            <ErrorState error={favorites.error} onRetry={() => void favorites.refetch()} />
          )}
          {message && (
            <p role={messageKind === 'error' ? 'alert' : 'status'}>
              {message}
              {messageKind === 'success' && message.includes('سبد') && (
                <>
                  {' '}
                  <Link to="/cart">مشاهدهٔ سبد خرید</Link>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <section className="product-detail__description">
        <h2>توضیحات</h2>
        <p>{detail.description || 'توضیحی برای این محصول ثبت نشده است.'}</p>
        {detail.ingredientsText && (
          <>
            <h2>ترکیبات</h2>
            <p>{detail.ingredientsText}</p>
          </>
        )}
        {detail.tags.length > 0 && (
          <>
            <h2>برچسب‌ها</h2>
            <ul>
              {detail.tags.map((tag) => (
                <li key={tag.id}>{tag.name}</li>
              ))}
            </ul>
          </>
        )}
        <p>
          <Link to="/recommendations">محصولات مناسب پت من</Link>
        </p>
      </section>
      <Dialog
        open={galleryOpen}
        title={detail.name}
        description="نمایش بزرگ‌تر تصاویر محصول"
        onClose={() => setGalleryOpen(false)}
      >
        <div className="commerce-gallery-viewer">
          <SafeImage src={imageUrl ?? undefined} alt={detail.name} referrerPolicy="no-referrer" />
          {images.length > 1 && (
            <nav aria-label="تصاویر محصول">
              <button
                type="button"
                onClick={() => {
                  const index = images.findIndex((image) => image.id === selectedImage?.id);
                  setSelectedImageId(images[(index - 1 + images.length) % images.length]!.id);
                }}
              >
                تصویر قبلی
              </button>
              <span role="status">
                {(images.findIndex((image) => image.id === selectedImage?.id) + 1).toLocaleString(
                  'fa-IR',
                )}{' '}
                از {images.length.toLocaleString('fa-IR')}
              </span>
              <button
                type="button"
                onClick={() => {
                  const index = images.findIndex((image) => image.id === selectedImage?.id);
                  setSelectedImageId(images[(index + 1) % images.length]!.id);
                }}
              >
                تصویر بعدی
              </button>
            </nav>
          )}
        </div>
      </Dialog>
    </article>
  );
}
