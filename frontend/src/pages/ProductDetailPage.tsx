import '../styles/content-pages.css';
import '../styles/product-detail-experience.css';
import '../styles/product-detail-layout.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { useAuth } from '../auth/auth-provider';
import { ErrorState, LoadingState } from '../components/states';
import { MAX_CART_ITEM_QTY } from '../lib/constants';
import { formatToman, formatWeight } from '../lib/format';
import { errorText, LIFE_STAGE_FA, SIZE_CLASS_FA, NEUTER_FA } from '../lib/labels';
import { safeImageUrl } from '../lib/image-url';
import { API_BASE_URL } from '../lib/env';
import { SafeImage } from '../components/SafeImage';
import { Dialog } from '../components/ui/interactive';
import { isSampleProduct, publicRecordName } from '../lib/sample-records';
import { ProductGallery } from '../components/ProductGallery';
import { QuantityField } from '../components/QuantityField';
import { signalCartAdded } from '../features/cart/cart-feedback';
import { RelatedProducts } from '../components/RelatedProducts';
import {
  addGuestCartItem,
  readGuestCart,
  readGuestTransfer,
  useGuestCart,
  useGuestTransferCheckpoint,
} from '../features/cart/guest-cart';

/** Product detail: variant selection, add-to-cart and favorite toggle (F5/F7/F8 behaviour). */
export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { status, user } = useAuth();
  const isAuthenticated = status === 'authed';
  const identity = isAuthenticated ? (user?.id ?? null) : null;
  const guestItems = useGuestCart();
  const guestTransfer = useGuestTransferCheckpoint();
  const handoffPending = isAuthenticated && (guestItems.length > 0 || guestTransfer !== null);
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
  const addWasKeyboardRef = useRef(true);
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
      status === 'loading' ||
      handoffPending ||
      (product.data && isSampleProduct(product.data)) ||
      !activeVariant?.inStock ||
      !validQuantity
    )
      return;
    const requestSlug = slugRef.current;
    const generation = generationRef.current;
    const feedbackKeyboard = addWasKeyboardRef.current;
    const feedbackSource =
      event.currentTarget
        .closest('.product-detail')
        ?.querySelector<HTMLElement>('.product-detail__gallery') ?? null;
    if (status === 'guest' && identityRef.current === null && product.data && activeVariant) {
      try {
        addGuestCartItem(product.data, activeVariant, quantity);
        setMessageKind('success');
        setMessage('به سبد خرید اضافه شد.');
        signalCartAdded({ userId: null, keyboard: feedbackKeyboard, source: feedbackSource });
      } catch (problem) {
        setMessageKind('error');
        setMessage(errorText(problem));
      }
      return;
    }
    if (identityRef.current === null || readGuestCart().length > 0 || readGuestTransfer() !== null)
      return;
    const requestIdentity = identityRef.current;
    addInFlightRef.current = true;
    setAddPending(true);
    setMessage(null);
    void addToCart
      .mutateAsync({ variantId: activeVariant.id, count: quantity })
      .then(() => {
        if (!responseIsCurrent(requestIdentity, requestSlug, generation)) return;
        setMessageKind('success');
        setMessage('به سبد خرید اضافه شد.');
        signalCartAdded({
          userId: requestIdentity,
          keyboard: feedbackKeyboard,
          source: feedbackSource,
        });
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
          <LoadingState layout="detail" />
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
  const sample = isSampleProduct(detail);
  const available = !sample && activeVariant?.inStock === true;
  const facts = [
    ['نوع حیوان', detail.petType.name],
    ['سن', LIFE_STAGE_FA[detail.lifeStage]],
    ['جثه', SIZE_CLASS_FA[detail.sizeClass]],
  ];

  return (
    <article className="product-detail">
      <nav className="product-detail__breadcrumb" aria-label="مسیر">
        <Link to="/">فروشگاه دکتر گوپت</Link> / <Link to="/products">محصولات</Link> /{' '}
        <Link to={`/products?categorySlug=${encodeURIComponent(detail.category.slug)}`}>
          {publicRecordName(detail.category)}
        </Link>
      </nav>
      <div className="product-detail__main">
        <ProductGallery
          images={images}
          selectedId={selectedImageId}
          name={publicRecordName(detail)}
          onSelect={setSelectedImageId}
          onOpen={() => setGalleryOpen(true)}
        />
        <div className="product-detail__info">
          <Link className="product-detail__eyebrow" to={`/products?brandId=${detail.brand.id}`}>
            {publicRecordName(detail.brand)}
          </Link>
          <h1>{publicRecordName(detail)}</h1>
          <dl className="product-detail__facts" aria-label="ویژگی‌های اصلی محصول">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <fieldset className="commerce-variants">
            <legend>وزن بسته</legend>
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
                  {!sample && variant.inStock && <span>{formatToman(variant.price)}</span>}
                </span>
                <span className="commerce-variant-stock">
                  {!sample && variant.inStock
                    ? variant.lowStock
                      ? 'موجودی محدود'
                      : 'موجود'
                    : 'ناموجود'}
                </span>
              </label>
            ))}
          </fieldset>
          <a className="product-detail__spec-link" href="#product-specifications">
            مشاهدهٔ مشخصات
          </a>
        </div>
        <aside
          className="product-detail__purchase commerce-glass"
          aria-labelledby="product-purchase-heading"
        >
          <h2 id="product-purchase-heading">خرید محصول</h2>
          <p className="product-detail__availability" data-available={available}>
            {available ? (activeVariant?.lowStock ? 'موجودی محدود' : 'موجود') : 'ناموجود'}
          </p>
          {activeVariant && (
            <p className="product-detail__selected-weight">
              {formatWeight(activeVariant.weightGram)}
            </p>
          )}
          <form onSubmit={submitAddToCart} aria-label="خرید محصول">
            {available && activeVariant && (
              <div className="commerce-product-price">
                {activeVariant.compareAtPrice &&
                activeVariant.compareAtPrice > activeVariant.price ? (
                  <del aria-label="قیمت پیشین">{formatToman(activeVariant.compareAtPrice)}</del>
                ) : null}
                <strong>{formatToman(activeVariant.price)}</strong>
              </div>
            )}
            <div className="product-detail__buy-row">
              <QuantityField
                id="qty"
                value={quantityInput}
                onChange={setQuantityInput}
                max={MAX_CART_ITEM_QTY}
                disabled={addPending}
              />

              <button
                type="submit"
                onClick={(event) => {
                  addWasKeyboardRef.current = event.detail === 0;
                }}
                disabled={
                  isSampleProduct(detail) ||
                  status === 'loading' ||
                  handoffPending ||
                  !activeVariant?.inStock ||
                  !validQuantity ||
                  addPending
                }
              >
                {!available ? 'ناموجود' : addPending ? 'در حال افزودن…' : 'افزودن به سبد خرید'}
              </button>
            </div>
            {identity === null && !isSampleProduct(detail) && (
              <Link to="/cart">مشاهدهٔ سبد خرید مهمان</Link>
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
        </aside>
      </div>

      <nav className="product-detail__section-links" aria-label="بخش‌های محصول">
        {!sample && detail.description && <a href="#product-description">توضیحات</a>}
        <a href="#product-specifications">مشخصات</a>
        {!sample && detail.ingredientsText && <a href="#product-ingredients">ترکیبات</a>}
      </nav>
      {!sample && detail.description && (
        <section
          id="product-description"
          className="product-detail__section commerce-glass"
          aria-labelledby="product-description-heading"
        >
          <h2 id="product-description-heading">توضیحات</h2>
          <p>{detail.description}</p>
        </section>
      )}
      <section
        id="product-specifications"
        className="product-detail__section commerce-glass"
        aria-labelledby="product-specifications-heading"
      >
        <h2 id="product-specifications-heading">مشخصات</h2>
        <dl className="product-detail__specifications">
          <div>
            <dt>برند</dt>
            <dd>{publicRecordName(detail.brand)}</dd>
          </div>
          <div>
            <dt>دسته‌بندی</dt>
            <dd>{publicRecordName(detail.category)}</dd>
          </div>
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div>
            <dt>عقیم‌بودن</dt>
            <dd>{NEUTER_FA[detail.neuterSuitability]}</dd>
          </div>
          <div>
            <dt>وزن بسته‌ها</dt>
            <dd>
              {detail.variants.map((variant) => formatWeight(variant.weightGram)).join('، ') || '—'}
            </dd>
          </div>
        </dl>
        {detail.tags.length > 0 && (
          <>
            <h3>ویژگی‌های غذایی</h3>
            <ul className="product-detail__tags">
              {detail.tags.map((tag) => (
                <li key={tag.id}>{tag.name}</li>
              ))}
            </ul>
          </>
        )}
        <Link className="product-detail__recommendation" to="/recommendations">
          محصولات مناسب پت من
        </Link>
      </section>
      {!sample && detail.ingredientsText && (
        <section
          id="product-ingredients"
          className="product-detail__section commerce-glass"
          aria-labelledby="product-ingredients-heading"
        >
          <h2 id="product-ingredients-heading">ترکیبات</h2>
          <p>{detail.ingredientsText}</p>
        </section>
      )}
      <RelatedProducts product={detail} />
      <Dialog
        open={galleryOpen}
        title={publicRecordName(detail)}
        description="نمایش بزرگ‌تر تصاویر محصول"
        onClose={() => setGalleryOpen(false)}
      >
        <div className="commerce-gallery-viewer">
          <SafeImage
            src={imageUrl ?? undefined}
            alt={publicRecordName(detail)}
            referrerPolicy="no-referrer"
          />
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
