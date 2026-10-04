import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { shopApi, type CreateOrderInput } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { CartView, CouponPreview } from '../api/types';
import { useAuth } from '../auth/auth-provider';
import { ErrorState, LoadingState } from '../components/states';
import { cartFingerprint, shippingEstimate } from '../features/cart/cart-state';
import { writePendingOrder } from '../features/checkout/pending-order';
import { formatToman } from '../lib/format';
import { errorText } from '../lib/labels';

/**
 * Checkout (F9): the server computes every amount — this page only collects
 * address/coupon/note, then hands the browser over to the payment gateway.
 */
export function CheckoutPage() {
  const { status, user } = useAuth();
  const userId = status === 'authed' ? user?.id ?? null : null;
  // A new account gets a fresh checkout draft and new async request guards.
  return <CheckoutSession key={userId ?? 'guest'} userId={userId} />;
}

function CheckoutSession({ userId }: { userId: number | null }) {
  const queryClient = useQueryClient();
  const activeUserId = useRef<number | null>(null);
  const couponCodeRef = useRef('');
  const validationSequence = useRef(0);
  const previousCartKey = useRef<string | null>(null);
  const submitLocked = useRef(false);
  const sessionEpoch = useRef(0);
  useLayoutEffect(() => {
    sessionEpoch.current += 1;
    activeUserId.current = userId;
    return () => {
      sessionEpoch.current += 1;
      activeUserId.current = null;
      validationSequence.current += 1;
      submitLocked.current = false;
    };
  }, [userId]);

  const addresses = useQuery({ queryKey: queryKeys.addresses, queryFn: () => api.listAddresses(), enabled: userId !== null });
  const cart = useQuery({ queryKey: queryKeys.cart, queryFn: () => shopApi.cart(), enabled: userId !== null });

  const [addressId, setAddressId] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<{
    code: string;
    cartKey: string;
    userId: number;
    result: CouponPreview;
  } | null>(null);
  const [validationRequest, setValidationRequest] = useState<{ code: string; cartKey: string; userId: number } | null>(null);
  const [submittingForUser, setSubmittingForUser] = useState<number | null>(null);
  const [createdOrder, setCreatedOrder] = useState<{ id: number; userId: number } | null>(null);
  const [failure, setFailure] = useState<{ message: string; userId: number } | null>(null);

  const addressList = (addresses.data ?? []).filter((address) => address.userId === userId);
  const submitting = submittingForUser === userId;
  const createdOrderId = createdOrder?.userId === userId ? createdOrder.id : null;
  const shownFailure = failure?.userId === userId ? failure.message : null;
  const selectedAddress =
    (addressList.some((address) => address.id === addressId) ? addressId : null) ??
    addressList.find((address) => address.isDefault)?.id ??
    addressList[0]?.id ??
    null;
  const cartKey = cartFingerprint(cart.data);
  useLayoutEffect(() => {
    if (previousCartKey.current !== null && previousCartKey.current !== cartKey) {
      validationSequence.current += 1;
      setPreview(null);
      setValidationRequest(null);
    }
    previousCartKey.current = cartKey;
  }, [cartKey]);
  const validPreview = preview?.code === couponCode.trim() && preview.cartKey === cartKey && preview.userId === userId
    ? preview.result
    : null;
  const validating = validationRequest?.code === couponCode.trim() && validationRequest.cartKey === cartKey && validationRequest.userId === userId;
  const itemsTotal = cart.data?.itemsTotal ?? 0;
  const discount = validPreview?.discountAmount ?? 0;
  const shipping = shippingEstimate(cart.data);
  const payableEstimate = Math.max(0, itemsTotal - discount + shipping.cost);
  const blocked =
    (cart.data?.items.some((item) => !item.available) ?? false) ||
    (cart.data?.items.length ?? 0) === 0;
  const couponNeedsValidation = couponCode.trim().length > 0 && !validPreview;

  function requireSameUser(expectedUserId: number, expectedEpoch: number) {
    if (activeUserId.current !== expectedUserId || sessionEpoch.current !== expectedEpoch) {
      throw new Error('نشست کاربری تغییر کرده است. برای دیدن وضعیت سفارش دوباره وارد شوید.');
    }
  }

  async function validateCoupon() {
    const code = couponCode.trim();
    if (!code || validating || !cart.data || cart.isFetching || userId === null) return;
    const snapshot = cartFingerprint(cart.data);
    const sequence = ++validationSequence.current;
    const epoch = sessionEpoch.current;
    setPreview(null);
    setFailure(null);
    setValidationRequest({ code, cartKey: snapshot, userId });
    try {
      const result = await shopApi.validateCoupon(code);
      if (sequence === validationSequence.current && activeUserId.current === userId && sessionEpoch.current === epoch && couponCodeRef.current.trim() === code &&
          cartFingerprint(queryClient.getQueryData<CartView>(queryKeys.cart)) === snapshot) {
        setPreview({ code, cartKey: snapshot, userId, result });
      }
    } catch (error) {
      if (sequence === validationSequence.current && activeUserId.current === userId && sessionEpoch.current === epoch && couponCodeRef.current.trim() === code &&
          cartFingerprint(queryClient.getQueryData<CartView>(queryKeys.cart)) === snapshot) {
        setFailure({ message: errorText(error), userId });
      }
    } finally {
      if (sequence === validationSequence.current && activeUserId.current === userId && sessionEpoch.current === epoch) setValidationRequest(null);
    }
  }

  const submitOrder = useMutation({
    mutationFn: async (action: { kind: 'create'; payload: CreateOrderInput; userId: number; epoch: number } | { kind: 'retry'; orderId: number; userId: number; epoch: number }) => {
      requireSameUser(action.userId, action.epoch);
      let orderId: number;
      if (action.kind === 'create') {
        const order = await shopApi.createOrder(action.payload);
        requireSameUser(action.userId, action.epoch);
        orderId = order.id;
        setCreatedOrder({ id: order.id, userId: action.userId });
        writePendingOrder({ orderId: order.id, orderNumber: order.orderNumber });
        void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
        void queryClient.invalidateQueries({ queryKey: ['orders'] });
      } else {
        orderId = action.orderId;
      }
      const { paymentUrl } = await shopApi.startPayment(orderId);
      requireSameUser(action.userId, action.epoch);
      return { paymentUrl, userId: action.userId, epoch: action.epoch };
    },
    onSuccess: ({ paymentUrl, userId: submittedUserId, epoch }) => {
      if (activeUserId.current === submittedUserId && sessionEpoch.current === epoch) window.location.assign(paymentUrl);
    },
    onError: (error, action) => {
      if (activeUserId.current !== action.userId || sessionEpoch.current !== action.epoch) return;
      setFailure({ message: errorText(error), userId: action.userId });
      submitLocked.current = false;
      setSubmittingForUser(null);
    },
  });
  const mutationPending = submitOrder.isPending && submitOrder.variables?.userId === userId;
  const cannotSubmit = userId === null || createdOrderId !== null || selectedAddress === null || blocked || couponNeedsValidation ||
    validating || cart.isFetching || addresses.isFetching || submitting || mutationPending;

  if (userId === null) return <section><h1>تکمیل خرید</h1><p>
    برای ثبت سفارش <Link to="/login?next=/checkout">ورود کنید</Link>.
  </p></section>;
  if (addresses.isLoading || cart.isLoading) return <LoadingState />;
  if (addresses.error)
    return <ErrorState error={addresses.error} onRetry={() => void addresses.refetch()} />;
  if (cart.error) return <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />;

  function submit(event: FormEvent) {
    event.preventDefault();
    // The ref closes the gap before React has rendered the pending mutation state.
    if (userId === null || selectedAddress === null || submitLocked.current || cannotSubmit ||
        queryClient.isFetching({ queryKey: queryKeys.cart }) > 0 ||
        cartFingerprint(queryClient.getQueryData<CartView>(queryKeys.cart)) !== cartKey ||
        !addresses.data?.some((address) => address.id === selectedAddress && address.userId === userId)) return;
    const trimmedNote = note.trim();
    if (trimmedNote.length > 500) return;
    const payload: CreateOrderInput = {
      addressId: selectedAddress,
      couponCode: validPreview?.code,
      note: trimmedNote || undefined,
    };
    submitLocked.current = true;
    setSubmittingForUser(userId);
    setCreatedOrder(null);
    setFailure(null);
    submitOrder.mutate({ kind: 'create', payload, userId, epoch: sessionEpoch.current });
  }

  function retryPayment() {
    if (userId === null || createdOrderId === null || submitting || submitLocked.current) return;
    submitLocked.current = true;
    setSubmittingForUser(userId);
    setFailure(null);
    submitOrder.mutate({ kind: 'retry', orderId: createdOrderId, userId, epoch: sessionEpoch.current });
  }

  return (
    <section>
      <h1>تکمیل خرید</h1>

      {shownFailure && (
        <p role="alert">
          {shownFailure} {shownFailure.includes('خالی') && <Link to="/cart">بازگشت به سبد خرید</Link>}
          {createdOrderId !== null && <Link to={`/orders/${createdOrderId}`}>مشاهدهٔ سفارش ثبت‌شده</Link>}
        </p>
      )}

      <form onSubmit={submit}>
        <fieldset>
          <legend>آدرس تحویل</legend>
          {addressList.length === 0 && (
            <p>
              آدرسی ثبت نکرده‌اید — <Link to="/addresses/new">افزودن آدرس</Link>
            </p>
          )}
          {addressList.map((address) => (
            <label key={address.id}>
              <input
                type="radio"
                name="address"
                value={address.id}
                checked={selectedAddress === address.id}
                onChange={() => setAddressId(address.id)}
              />
              {address.title} — {address.receiverName}، {address.city}{' '}
              {address.isDefault ? '(پیش‌فرض)' : ''}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>کد تخفیف</legend>
          <input
            dir="ltr"
            value={couponCode}
            onChange={(event) => {
              couponCodeRef.current = event.target.value;
              validationSequence.current += 1;
              setCouponCode(event.target.value);
              setPreview(null);
              setValidationRequest(null);
              setFailure(null);
            }}
            placeholder="SUMMER20"
          />
          <button
            type="button"
            disabled={!couponCode.trim() || validating || cart.isFetching}
            onClick={() => void validateCoupon()}
          >
            بررسی کد
          </button>
          {validPreview && <p>تخفیف {formatToman(validPreview.discountAmount)} اعمال شد.</p>}
          {couponNeedsValidation && !validating && <p>برای استفاده از کد، ابتدا آن را بررسی کنید.</p>}
        </fieldset>

        <fieldset>
          <legend>خلاصه سفارش</legend>
          <dl>
            <dt>جمع کالاها</dt>
            <dd dir="ltr">{formatToman(itemsTotal)}</dd>
            <dt>تخفیف</dt>
            <dd dir="ltr">{formatToman(discount)}</dd>
            <dt>{shipping.source === 'server' ? 'ارسال (برآورد سرور)' : 'ارسال (برآورد محلی؛ نرخ سرور نامعتبر یا ناموجود)'}</dt>
            <dd dir="ltr">{shipping.cost === 0 ? 'رایگان' : formatToman(shipping.cost)}</dd>
            <dt>قابل پرداخت (تخمینی)</dt>
            <dd dir="ltr">{formatToman(payableEstimate)}</dd>
          </dl>
          <p>مبلغ نهایی فقط سمت سرور محاسبه و در رسید سفارش ثبت می‌شود.</p>
        </fieldset>

        <label htmlFor="note">یادداشت سفارش (اختیاری)</label>
        <textarea id="note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value.slice(0, 500))} />

        <button
          type="submit"
          disabled={cannotSubmit}
        >
          {submitOrder.isPending ? 'در حال ثبت سفارش…' : 'ثبت سفارش و پرداخت'}
        </button>
      </form>
      {createdOrderId !== null && (
        <button type="button" disabled={userId === null || submitting || mutationPending} onClick={retryPayment}>
          تلاش دوباره برای پرداخت همین سفارش
        </button>
      )}
    </section>
  );
}
