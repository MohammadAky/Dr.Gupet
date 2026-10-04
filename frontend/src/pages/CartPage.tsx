import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { UserProfile } from '../api/types';
import { useAuth } from '../auth/auth-provider';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { cartFingerprint, shippingEstimate as getShippingEstimate } from '../features/cart/cart-state';
import { MAX_CART_ITEM_QTY } from '../lib/constants';
import { formatToman, formatWeight } from '../lib/format';
import { errorText } from '../lib/labels';

/**
 * Cart (F8): the server view is always authoritative; totals are never
 * recomputed here, only displayed. Shipping is a marked estimate (BE-REQ-04).
 */
export function CartPage() {
  const { status, user } = useAuth();
  const isAuthenticated = status === 'authed';
  const identity = isAuthenticated ? user : null;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [couponCode, setCouponCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
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
    enabled: isAuthenticated,
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
    return () => { mountedRef.current = false; couponRequestRef.current += 1; };
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

  function runCartWrite(operation: () => Promise<unknown>) {
    if (cartWriteRef.current || !identityRef.current) return;
    const requestIdentity = identityRef.current;
    const generation = ++cartWriteGenerationRef.current;
    cartWriteRef.current = true;
    setCartWritePending(true);
    invalidateCoupon();
    setNotice(null);
    void operation()
      .then(async () => {
        if (mountedRef.current && identityRef.current === requestIdentity &&
          cartWriteGenerationRef.current === generation) await invalidate();
      })
      .catch((error: unknown) => {
        if (mountedRef.current && identityRef.current === requestIdentity &&
          cartWriteGenerationRef.current === generation) setNotice(errorText(error));
      })
      .finally(() => {
        if (identityRef.current !== requestIdentity || cartWriteGenerationRef.current !== generation) return;
        cartWriteRef.current = false;
        if (mountedRef.current) setCartWritePending(false);
      });
  }

  if (!isAuthenticated) {
    return (
      <section>
        <h1>سبد خرید</h1>
        <p>
          برای مشاهدهٔ سبد خرید <Link to="/login?next=/cart">ورود کنید</Link>.
        </p>
      </section>
    );
  }

  if (cart.isLoading) return <LoadingState />;
  if (cart.error) return <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />;

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
    void validateCoupon.mutateAsync(code)
      .then((preview) => {
        if (!mountedRef.current || request !== couponRequestRef.current ||
          cartAtRequest !== fingerprintRef.current || couponCodeRef.current.trim() !== code ||
          identityRef.current !== requestIdentity || cartWriteRef.current) return;
        setCouponPreview({ requestedCode: code, code: preview.code, discountAmount: preview.discountAmount,
          cartFingerprint: cartAtRequest, identity: requestIdentity });
        setCouponPending(false);
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || request !== couponRequestRef.current ||
          cartAtRequest !== fingerprintRef.current || couponCodeRef.current.trim() !== code ||
          identityRef.current !== requestIdentity || cartWriteRef.current) return;
        setNotice(errorText(error));
        setCouponPending(false);
      });
  }

  return (
    <section>
      <h1>سبد خرید</h1>

      {view && view.items.length === 0 && (
        <EmptyState
          text="سبد خرید شما خالی است."
          action={<Link to="/products">مشاهدهٔ محصولات</Link>}
        />
      )}

      {view && view.items.length > 0 && (
        <>
          <ul>
            {view.items.map((item) => (
              <li key={item.id} data-available={String(item.available)}>
                <p>
                  {item.productName} — {formatWeight(item.weightGram)}
                </p>
                <p dir="ltr">{formatToman(item.unitPrice)}</p>
                <label>
                  تعداد
                  <input
                    type="number"
                    min={1}
                    max={MAX_CART_ITEM_QTY}
                    step={1}
                    dir="ltr"
                    value={item.quantity}
                    disabled={cartWritePending || cart.isFetching}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isSafeInteger(next) || next < 1 || next > MAX_CART_ITEM_QTY) return;
                      runCartWrite(() => updateQuantity.mutateAsync({ itemId: item.id, quantity: next }));
                    }}
                  />
                </label>
                <p dir="ltr">{formatToman(item.total)}</p>
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
                <button type="button" disabled={cartWritePending || cart.isFetching}
                  onClick={() => runCartWrite(() => removeItem.mutateAsync(item.id))}>
                  حذف
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={submitCoupon}>
            <label htmlFor="coupon">کد تخفیف</label>
            <input
              id="coupon"
              dir="ltr"
              value={couponCode}
              onChange={(event) => { invalidateCoupon(); setNotice(null); setCouponCode(event.target.value); }}
            />
            <button type="submit" disabled={!couponCode.trim() || couponPending || cartWritePending || cart.isFetching}>
              اعمال کد
            </button>
          </form>
          {shownCoupon && (
            <p>
              تخفیف {shownCoupon.code}: {formatToman(shownCoupon.discountAmount)} (بدون هزینهٔ
              ارسال)
            </p>
          )}

          <dl>
            <dt>جمع کالاها</dt>
            <dd dir="ltr">{formatToman(view.itemsTotal)}</dd>
            <dt>
              هزینهٔ ارسال ({shipping.source === 'server' ? 'تخمین سرور' : 'تخمین محلیِ جایگزین'})
            </dt>
            <dd dir="ltr">{shipping.cost === 0 ? 'رایگان' : formatToman(shipping.cost)}</dd>
          </dl>
          <p>
            {shipping.source === 'server'
              ? view.estimate?.note
              : 'این عدد تنها تخمین محلی است؛ نسخهٔ فعلی پاسخ سبد خرید، تخمین سرور را ارائه نکرد.'}{' '}
            مبلغ قطعی پس از اعمال کد تخفیف در مرحلهٔ سفارش محاسبه می‌شود.
          </p>

          {notice && <p role="alert">{notice}</p>}

          <button type="button" disabled={hasProblem || cartWritePending || cart.isFetching}
            onClick={() => navigate('/checkout')}>
            تکمیل خرید
          </button>
          <button type="button" disabled={cartWritePending || cart.isFetching}
            onClick={() => runCartWrite(() => clearCart.mutateAsync())}>
            خالی‌کردن سبد
          </button>
        </>
      )}
    </section>
  );
}
