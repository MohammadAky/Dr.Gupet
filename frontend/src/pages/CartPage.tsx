import '../styles/content-pages.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { UserProfile } from '../api/types';
import { useAuth } from '../auth/auth-provider';
import { ErrorState, LoadingState } from '../components/states';
import {
  cartFingerprint,
  shippingEstimate as getShippingEstimate,
} from '../features/cart/cart-state';
import { MAX_CART_ITEM_QTY } from '../lib/constants';
import { formatToman, formatWeight } from '../lib/format';
import { errorText } from '../lib/labels';
import { safeImageUrl } from '../lib/image-url';
import { API_BASE_URL } from '../lib/env';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SafeImage } from '../components/SafeImage';
import { CommerceSteps } from '../components/CommerceSteps';
import { ShippingProgress } from '../components/ShippingProgress';
import { EmptyCartIllustration } from '../components/EmptyCartIllustration';
import { QuantityField, parseQuantityInput } from '../components/QuantityField';
import { readCheckoutIntent, writeCheckoutIntent } from '../features/checkout/intent';
import { useGuestCart, useGuestTransferCheckpoint } from '../features/cart/guest-cart';
import { GuestCartPage } from './GuestCartPage';

/**
 * Cart (F8): the server view is always authoritative; totals are never
 * recomputed here, only displayed. Shipping is a marked estimate (BE-REQ-04).
 */
export function CartPage() {
  const { status, user } = useAuth();
  const isAuthenticated = status === 'authed';
  const guestItems = useGuestCart();
  const guestTransfer = useGuestTransferCheckpoint();
  const identity = isAuthenticated ? user : null;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [couponCode, setCouponCode] = useState(() =>
    identity ? readCheckoutIntent(identity.id).couponCode : '',
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'error' | 'success'>('error');
  const [clearOpen, setClearOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [dirtyQuantities, setDirtyQuantities] = useState<Set<number>>(() => new Set());
  const markQuantityDirty = useCallback((id: number, dirty: boolean) => {
    setDirtyQuantities((current) => {
      if (current.has(id) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const [couponPreview, setCouponPreview] = useState<{
    requestedCode: string;
    code: string;
    discountAmount: number;
    cartFingerprint: string;
    identity: UserProfile | null;
  } | null>(null);
  const [couponPending, setCouponPending] = useState(false);
  const [cartWritePending, setCartWritePending] = useState(false);
  const cartWriteRef = useRef(false);
  const cartWriteGenerationRef = useRef(0);
  const couponRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const identityRef = useRef(identity);
  const previousIdentityRef = useRef(identity);

  const cart = useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => shopApi.cart(),
    enabled: isAuthenticated && guestItems.length === 0 && guestTransfer === null,
  });
  const view = cart.data;
  const fingerprint = cartFingerprint(view);
  const fingerprintRef = useRef(fingerprint);
  const previousFingerprintRef = useRef(fingerprint);
  const couponCodeRef = useRef(couponCode);

  useLayoutEffect(() => {
    identityRef.current = identity;
    fingerprintRef.current = fingerprint;
    couponCodeRef.current = couponCode;
  }, [identity, fingerprint, couponCode]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      couponRequestRef.current += 1;
    };
  }, []);

  useLayoutEffect(() => {
    if (previousIdentityRef.current === identity) return;
    previousIdentityRef.current = identity;
    couponRequestRef.current += 1;
    cartWriteGenerationRef.current += 1;
    cartWriteRef.current = false;
    setCouponPreview(null);
    setCouponPending(false);
    setCartWritePending(false);
    setNotice(null);
    setClearOpen(false);
    setDirtyQuantities(new Set());
    setCouponCode(identity ? readCheckoutIntent(identity.id).couponCode : '');
  }, [identity]);

  useLayoutEffect(() => {
    if (previousFingerprintRef.current === fingerprint) return;
    previousFingerprintRef.current = fingerprint;
    couponRequestRef.current += 1;
    setCouponPreview(null);
    setCouponPending(false);
  }, [fingerprint]);

  function invalidateCoupon() {
    couponRequestRef.current += 1;
    setCouponPreview(null);
    setCouponPending(false);
  }

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: queryKeys.cart });
  }

  const updateQuantity = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: number; quantity: number }) =>
      shopApi.updateCartItem(itemId, quantity),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: number) => shopApi.removeCartItem(itemId),
  });

  const clearCart = useMutation({
    mutationFn: () => shopApi.clearCart(),
  });

  const validateCoupon = useMutation({
    mutationFn: (code: string) => shopApi.validateCoupon(code),
  });

  async function runCartWrite(
    operation: () => Promise<unknown>,
    completion?: string,
    removedId?: number,
    failureInDialog = false,
  ) {
    if (
      cartWriteRef.current ||
      !identityRef.current ||
      queryClient.isFetching({ queryKey: queryKeys.cart }) > 0
    ) {
      if (failureInDialog)
        throw new Error('سبد در حال به‌روزرسانی است. پس از پایان دوباره تلاش کنید.');
      return;
    }
    const requestIdentity = identityRef.current;
    const generation = ++cartWriteGenerationRef.current;
    cartWriteRef.current = true;
    setCartWritePending(true);
    invalidateCoupon();
    setNotice(null);
    setNoticeKind('error');
    return operation()
      .then(async () => {
        if (
          mountedRef.current &&
          identityRef.current === requestIdentity &&
          cartWriteGenerationRef.current === generation
        ) {
          await invalidate();
          if (
            mountedRef.current &&
            identityRef.current === requestIdentity &&
            cartWriteGenerationRef.current === generation &&
            completion
          ) {
            setNoticeKind('success');
            setNotice(completion);
            if (removedId !== undefined) markQuantityDirty(removedId, false);
            else setDirtyQuantities(new Set());
            headingRef.current?.focus();
          }
        }
      })
      .catch((error: unknown) => {
        if (
          mountedRef.current &&
          identityRef.current === requestIdentity &&
          cartWriteGenerationRef.current === generation
        ) {
          if (!failureInDialog) setNotice(errorText(error));
          else throw error;
        }
      })
      .finally(() => {
        if (
          identityRef.current !== requestIdentity ||
          cartWriteGenerationRef.current !== generation
        )
          return;
        cartWriteRef.current = false;
        if (mountedRef.current) setCartWritePending(false);
      });
  }

  if (!isAuthenticated) {
    return status === 'loading' ? <LoadingState layout="rows" /> : <GuestCartPage />;
  }
  if (guestItems.length > 0 || guestTransfer !== null)
    return <GuestCartPage transferring actorId={identity?.id} />;

  if (cart.isLoading || cart.error)
    return (
      <section className="account-page account-commerce-page">
        <header className="account-heading">
          <h1>سبد خرید</h1>
          <Link to="/products">ادامه خرید</Link>
        </header>
        {cart.isLoading ? (
          <LoadingState layout="rows" />
        ) : (
          <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
        )}
      </section>
    );

  const hasProblem = view?.items.some((item) => !item.available) ?? false;
  const shipping = getShippingEstimate(view);
  const shownCoupon =
    couponPreview?.requestedCode === couponCode.trim() &&
    couponPreview.cartFingerprint === fingerprint &&
    couponPreview.identity === identity &&
    !cartWritePending &&
    !cart.isFetching
      ? couponPreview
      : null;

  function submitCoupon(event: FormEvent) {
    event.preventDefault();
    const code = couponCode.trim();
    if (!code || cartWriteRef.current || cart.isFetching) return;
    setNotice(null);
    setCouponPreview(null);
    setCouponPending(true);
    const request = ++couponRequestRef.current;
    const cartAtRequest = fingerprint;
    const requestIdentity = identity;
    void validateCoupon
      .mutateAsync(code)
      .then((preview) => {
        if (
          !mountedRef.current ||
          request !== couponRequestRef.current ||
          cartAtRequest !== fingerprintRef.current ||
          couponCodeRef.current.trim() !== code ||
          identityRef.current !== requestIdentity ||
          cartWriteRef.current
        )
          return;
        setCouponPreview({
          requestedCode: code,
          code: preview.code,
          discountAmount: preview.discountAmount,
          cartFingerprint: cartAtRequest,
          identity: requestIdentity,
        });
        setCouponPending(false);
      })
      .catch((error: unknown) => {
        if (
          !mountedRef.current ||
          request !== couponRequestRef.current ||
          cartAtRequest !== fingerprintRef.current ||
          couponCodeRef.current.trim() !== code ||
          identityRef.current !== requestIdentity ||
          cartWriteRef.current
        )
          return;
        setNotice(errorText(error));
        setCouponPending(false);
      });
  }

  return (
    <section className="account-page account-commerce-page">
      <header className="account-heading">
        <div>
          <h1 ref={headingRef} tabIndex={-1}>
            سبد خرید
          </h1>
        </div>
        <Link className="account-secondary-link" to="/products">
          ادامه خرید
        </Link>
      </header>
      <div className="commerce-journey">
        {view && <ShippingProgress cart={view} />}
        <CommerceSteps current="cart" />
      </div>

      {view && view.items.length === 0 && (
        <div className="account-empty-cart commerce-glass">
          <div className="account-empty-cart__copy">
            <h2>سبد خرید شما خالی است.</h2>
            <div className="account-actions">
              <Link className="account-primary-link" to="/products">
                مشاهدهٔ محصولات <span aria-hidden="true">←</span>
              </Link>
              <Link className="account-secondary-link" to="/favorites">
                علاقه‌مندی‌های من
              </Link>
            </div>
          </div>
          <EmptyCartIllustration />
        </div>
      )}

      {view && view.items.length > 0 && (
        <div className="account-shopping-layout">
          <ul className="account-cart-items">
            {view.items.map((item) => {
              const image = safeImageUrl(item.productImage, window.location.origin, API_BASE_URL);
              return (
                <li key={item.id} data-available={String(item.available)}>
                  <div className="account-cart-product">
                    <SafeImage
                      src={image ?? undefined}
                      alt={item.productName}
                      width={88}
                      height={88}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <Link to={`/products/${item.productSlug}`}>{item.productName}</Link>
                      <p className="account-subtle">{formatWeight(item.weightGram)}</p>
                      <p className="account-subtle">
                        قیمت واحد: <bdi>{formatToman(item.unitPrice)}</bdi>
                      </p>
                    </div>
                  </div>
                  <CartQuantity
                    id={item.id}
                    name={item.productName}
                    quantity={item.quantity}
                    locked={cartWritePending || cart.isFetching}
                    onDirty={markQuantityDirty}
                    onCommit={(quantity) =>
                      runCartWrite(() => updateQuantity.mutateAsync({ itemId: item.id, quantity }))
                    }
                  />
                  <p className="account-cart-total">{formatToman(item.total)}</p>
                  {item.stockProblem && (
                    <p role="alert">
                      {item.stockProblem === 'OUT_OF_STOCK'
                        ? 'این کالا ناموجود است.'
                        : 'موجودی کافی نیست؛ تعداد را کم کنید.'}
                    </p>
                  )}
                  {!item.available && !item.stockProblem && (
                    <p role="alert">این کالا در حال حاضر قابل خرید نیست.</p>
                  )}
                  <button
                    className="account-danger"
                    type="button"
                    disabled={cartWritePending || cart.isFetching}
                    onClick={() =>
                      runCartWrite(
                        () => removeItem.mutateAsync(item.id),
                        `«${item.productName}» از سبد حذف شد.`,
                        item.id,
                      )
                    }
                  >
                    حذف
                  </button>
                </li>
              );
            })}
          </ul>

          <aside className="account-shopping-summary" aria-label="خلاصه سبد خرید">
            <h2>خلاصه سبد خرید</h2>
            <form className="account-coupon-form" onSubmit={submitCoupon}>
              <label htmlFor="coupon">کد تخفیف</label>
              <input
                id="coupon"
                dir="ltr"
                value={couponCode}
                onChange={(event) => {
                  invalidateCoupon();
                  setNotice(null);
                  setCouponCode(event.target.value);
                  if (identity)
                    writeCheckoutIntent(identity.id, { couponCode: event.target.value });
                }}
              />
              <button
                type="submit"
                disabled={
                  !couponCode.trim() || couponPending || cartWritePending || cart.isFetching
                }
              >
                {couponPending ? 'در حال بررسی…' : 'بررسی کد'}
              </button>
            </form>
            {shownCoupon && (
              <p>
                تخفیف {shownCoupon.code}: {formatToman(shownCoupon.discountAmount)} (بدون هزینهٔ
                ارسال)
              </p>
            )}

            <dl className="account-totals">
              <dt>جمع کالاها</dt>
              <dd dir="ltr">{formatToman(view.itemsTotal)}</dd>
              <dt>
                هزینهٔ ارسال ({shipping.source === 'server' ? 'برآورد سامانه' : 'برآورد اولیه'})
              </dt>
              <dd dir="ltr">{shipping.cost === 0 ? 'رایگان' : formatToman(shipping.cost)}</dd>
            </dl>
            <p className="account-subtle">
              {shipping.source === 'server'
                ? view.estimate?.note
                : 'هزینهٔ ارسال برآوردی است و هنگام ثبت سفارش نهایی می‌شود.'}{' '}
              مبلغ قطعی پس از اعمال کد تخفیف در مرحلهٔ سفارش محاسبه می‌شود.
            </p>

            {notice && <p role={noticeKind === 'error' ? 'alert' : 'status'}>{notice}</p>}
            {dirtyQuantities.size > 0 && (
              <p role="status">تعداد ویرایش‌شده را به‌روزرسانی کنید یا به مقدار قبلی برگردانید.</p>
            )}

            <button
              className="account-submit"
              type="button"
              disabled={
                hasProblem || dirtyQuantities.size > 0 || cartWritePending || cart.isFetching
              }
              onClick={() => {
                if (
                  cartWriteRef.current ||
                  dirtyQuantities.size > 0 ||
                  hasProblem ||
                  queryClient.isFetching({ queryKey: queryKeys.cart }) > 0
                )
                  return;
                if (identity) writeCheckoutIntent(identity.id, { couponCode: couponCode.trim() });
                navigate('/checkout');
              }}
            >
              تکمیل خرید
            </button>
            <button
              className="account-danger"
              type="button"
              disabled={cartWritePending || cart.isFetching}
              onClick={() => setClearOpen(true)}
            >
              خالی‌کردن سبد
            </button>
          </aside>
        </div>
      )}
      <ConfirmDialog
        open={clearOpen}
        title="خالی‌کردن سبد خرید"
        description={`همهٔ ${view?.items.length.toLocaleString('fa-IR') ?? '۰'} قلم از سبد شما حذف می‌شوند.`}
        confirmLabel="حذف همهٔ اقلام"
        pending={cartWritePending}
        onClose={() => setClearOpen(false)}
        onConfirm={() =>
          runCartWrite(() => clearCart.mutateAsync(), 'سبد خرید خالی شد.', undefined, true)
        }
      />
    </section>
  );
}

function CartQuantity({
  id,
  name,
  quantity,
  locked,
  onCommit,
  onDirty,
}: {
  id: number;
  name: string;
  quantity: number;
  locked: boolean;
  onCommit: (quantity: number) => void;
  onDirty: (id: number, dirty: boolean) => void;
}) {
  const [localDraft, setLocalDraft] = useState({ quantity, value: String(quantity) });
  const [localError, setLocalError] = useState({ quantity, value: '' });
  if (localDraft.quantity !== quantity) {
    setLocalDraft({ quantity, value: String(quantity) });
    setLocalError({ quantity, value: '' });
  }
  const draft = localDraft.quantity === quantity ? localDraft.value : String(quantity);
  const error = localError.quantity === quantity ? localError.value : '';
  const setDraft = (value: string) => setLocalDraft({ quantity, value });
  const setError = (value: string) => setLocalError({ quantity, value });
  useEffect(() => {
    onDirty(id, false);
    return () => onDirty(id, false);
  }, [id, quantity, onDirty]);
  const parsed = parseQuantityInput(draft, MAX_CART_ITEM_QTY);
  const valid = parsed !== null;
  function commit(value = parsed) {
    if (locked) return;
    if (
      !valid ||
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > MAX_CART_ITEM_QTY
    ) {
      setError(`تعداد باید عدد صحیح بین ۱ تا ${MAX_CART_ITEM_QTY.toLocaleString('fa-IR')} باشد.`);
      return;
    }
    setError('');
    setDraft(String(value));
    onDirty(id, value !== quantity);
    if (value !== quantity) onCommit(value);
    else onDirty(id, false);
  }
  return (
    <div className="commerce-quantity">
      <QuantityField
        id={`quantity-${id}`}
        max={MAX_CART_ITEM_QTY}
        ariaLabel={`تعداد ${name}`}
        value={draft}
        disabled={locked}
        invalid={error ? true : undefined}
        describedBy={error ? `quantity-error-${id}` : undefined}
        onChange={(value) => {
          setDraft(value);
          setError('');
          onDirty(id, value !== String(quantity));
        }}
        onBlur={(event) => {
          if (!event.currentTarget.closest('.commerce-quantity')?.contains(event.relatedTarget))
            commit();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      />
      {draft !== String(quantity) && (
        <div className="commerce-quantity__actions">
          <button type="button" disabled={locked} onClick={() => commit()}>
            به‌روزرسانی تعداد
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              setDraft(String(quantity));
              setError('');
              onDirty(id, false);
            }}
          >
            بازگرداندن تعداد
          </button>
        </div>
      )}
      {error && (
        <p id={`quantity-error-${id}`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
