import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { useAuth } from '../auth/auth-provider';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { FREE_SHIPPING_THRESHOLD, MAX_CART_ITEM_QTY, SHIPPING_FLAT_COST } from '../lib/constants';
import { formatToman, formatWeight } from '../lib/format';
import { errorText } from '../lib/labels';

/**
 * Cart (F8): the server view is always authoritative; totals are never
 * recomputed here, only displayed. Shipping is a marked estimate (BE-REQ-04).
 */
export function CartPage() {
  const { status } = useAuth();
  const isAuthenticated = status === 'authed';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [couponCode, setCouponCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [couponPreview, setCouponPreview] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);

  const cart = useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => shopApi.cart(),
    enabled: isAuthenticated,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
  }

  const updateQuantity = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: number; quantity: number }) =>
      shopApi.updateCartItem(itemId, quantity),
    onSuccess: invalidate,
    onError: (error) => setNotice(errorText(error)),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: number) => shopApi.removeCartItem(itemId),
    onSuccess: invalidate,
    onError: (error) => setNotice(errorText(error)),
  });

  const clearCart = useMutation({
    mutationFn: () => shopApi.clearCart(),
    onSuccess: () => {
      setCouponPreview(null);
      invalidate();
    },
    onError: (error) => setNotice(errorText(error)),
  });

  const validateCoupon = useMutation({
    mutationFn: (code: string) => shopApi.validateCoupon(code),
    onSuccess: (preview) => setCouponPreview(preview),
    onError: (error) => {
      setCouponPreview(null);
      setNotice(errorText(error));
    },
  });

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

  const view = cart.data;
  const hasProblem = view?.items.some((item) => !item.available) ?? false;
  const shippingEstimate = view && view.itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_COST;

  function submitCoupon(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    if (couponCode.trim()) validateCoupon.mutate(couponCode.trim());
  }

  return (
    <section>
      <h1>سبد خرید</h1>

      {view && view.items.length === 0 && (
        <EmptyState text="سبد خرید شما خالی است." action={<Link to="/products">مشاهدهٔ محصولات</Link>} />
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
                    dir="ltr"
                    value={item.quantity}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isFinite(next)) return;
                      updateQuantity.mutate({
                        itemId: item.id,
                        quantity: Math.min(Math.max(next, 1), MAX_CART_ITEM_QTY),
                      });
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
                <button type="button" onClick={() => removeItem.mutate(item.id)}>
                  حذف
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={submitCoupon}>
            <label htmlFor="coupon">کد تخفیف</label>
            <input id="coupon" dir="ltr" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} />
            <button type="submit" disabled={validateCoupon.isPending}>
              اعمال کد
            </button>
          </form>
          {couponPreview && (
            <p>
              تخفیف {couponPreview.code}: {formatToman(couponPreview.discountAmount)} (بدون هزینهٔ ارسال)
            </p>
          )}

          <dl>
            <dt>جمع کالاها</dt>
            <dd dir="ltr">{formatToman(view.itemsTotal)}</dd>
            <dt>هزینهٔ ارسال (تخمینی)</dt>
            <dd dir="ltr">{shippingEstimate === 0 ? 'رایگان' : formatToman(shippingEstimate)}</dd>
          </dl>
          <p>مبلغ نهایی پس از اعمال کد تخفیف در مرحلهٔ سفارش محاسبه می‌شود.</p>

          {notice && <p role="alert">{notice}</p>}

          <button type="button" disabled={hasProblem} onClick={() => navigate('/checkout')}>
            تکمیل خرید
          </button>
          <button type="button" onClick={() => clearCart.mutate()}>
            خالی‌کردن سبد
          </button>
        </>
      )}
    </section>
  );
}
