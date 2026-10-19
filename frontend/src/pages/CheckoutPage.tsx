import '../styles/content-pages.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { shopApi, type CreateOrderInput } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { CartView, CouponPreview } from '../api/types';
import { useAuth } from '../auth/auth-provider';
import { ErrorState, LoadingState } from '../components/states';
import { CommerceSteps } from '../components/CommerceSteps';
import { ShippingProgress } from '../components/ShippingProgress';
import { cartFingerprint, shippingEstimate } from '../features/cart/cart-state';
import { writePendingOrder } from '../features/checkout/pending-order';
import { formatToman } from '../lib/format';
import { errorText } from '../lib/labels';
import { GuestCartTransferGate } from '../components/GuestCartTransfer';
import { readGuestCart, readGuestTransfer } from '../features/cart/guest-cart';
import {
  clearCheckoutIntent,
  readCheckoutIntent,
  writeCheckoutIntent,
} from '../features/checkout/intent';

/**
 * Checkout (F9): the server computes every amount — this page only collects
 * address/coupon/note, then hands the browser over to the payment gateway.
 */
export function CheckoutPage() {
  const { status, user } = useAuth();
  const userId = status === 'authed' ? (user?.id ?? null) : null;
  // A new account gets a fresh checkout draft and new async request guards.
  return (
    <GuestCartTransferGate>
      <CheckoutSession key={userId ?? 'guest'} userId={userId} />
    </GuestCartTransferGate>
  );
}

function CheckoutSession({ userId }: { userId: number | null }) {
  const queryClient = useQueryClient();
  const activeUserId = useRef<number | null>(null);
  const [initialIntent] = useState(() =>
    userId === null ? { couponCode: '', note: '', addressId: null } : readCheckoutIntent(userId),
  );
  const couponCodeRef = useRef(initialIntent.couponCode);
  const transferredCode = useRef(initialIntent.couponCode);
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

  const addresses = useQuery({
    queryKey: queryKeys.addresses,
    queryFn: () => api.listAddresses(),
    enabled: userId !== null,
  });
  const cart = useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => shopApi.cart(),
    enabled: userId !== null,
  });

  const [addressId, setAddressId] = useState<number | null>(initialIntent.addressId);
  const [couponCode, setCouponCode] = useState(initialIntent.couponCode);
  const [note, setNote] = useState(initialIntent.note);
  const [preview, setPreview] = useState<{
    code: string;
    cartKey: string;
    userId: number;
    result: CouponPreview;
  } | null>(null);
  const [validationRequest, setValidationRequest] = useState<{
    code: string;
    cartKey: string;
    userId: number;
  } | null>(null);
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
  useEffect(() => {
    if (userId !== null && activeUserId.current === userId && createdOrderId === null)
      writeCheckoutIntent(userId, { couponCode, note, addressId: selectedAddress });
  }, [userId, couponCode, note, selectedAddress, createdOrderId]);
  const cartKey = cartFingerprint(cart.data);
  useLayoutEffect(() => {
    if (previousCartKey.current !== null && previousCartKey.current !== cartKey) {
      validationSequence.current += 1;
      setPreview(null);
      setValidationRequest(null);
    }
    previousCartKey.current = cartKey;
  }, [cartKey]);
  const validPreview =
    preview?.code === couponCode.trim() && preview.cartKey === cartKey && preview.userId === userId
      ? preview.result
      : null;
  const validating =
    validationRequest?.code === couponCode.trim() &&
    validationRequest.cartKey === cartKey &&
    validationRequest.userId === userId;
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

  const validateCoupon = useCallback(async () => {
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
      if (
        sequence === validationSequence.current &&
        activeUserId.current === userId &&
        sessionEpoch.current === epoch &&
        couponCodeRef.current.trim() === code &&
        cartFingerprint(queryClient.getQueryData<CartView>(queryKeys.cart)) === snapshot
      ) {
        setPreview({ code, cartKey: snapshot, userId, result });
      }
    } catch (error) {
      if (
        sequence === validationSequence.current &&
        activeUserId.current === userId &&
        sessionEpoch.current === epoch &&
        couponCodeRef.current.trim() === code &&
        cartFingerprint(queryClient.getQueryData<CartView>(queryKeys.cart)) === snapshot
      ) {
        setFailure({ message: errorText(error), userId });
      }
    } finally {
      if (
        sequence === validationSequence.current &&
        activeUserId.current === userId &&
        sessionEpoch.current === epoch
      )
        setValidationRequest(null);
    }
  }, [couponCode, validating, cart.data, cart.isFetching, userId, queryClient]);

  useEffect(() => {
    if (
      !transferredCode.current ||
      couponCode !== transferredCode.current ||
      !cart.data ||
      cart.isFetching ||
      userId === null
    )
      return;
    transferredCode.current = '';
    void validateCoupon();
  }, [couponCode, cart.data, cart.isFetching, userId, validateCoupon]);

  const submitOrder = useMutation({
    mutationFn: async (
      action:
        | { kind: 'create'; payload: CreateOrderInput; userId: number; epoch: number }
        | { kind: 'retry'; orderId: number; userId: number; epoch: number },
    ) => {
      requireSameUser(action.userId, action.epoch);
      if (readGuestCart().length > 0 || readGuestTransfer() !== null)
        throw new Error('ابتدا انتقال سبد مهمان را تکمیل کنید.');
      let orderId: number;
      if (action.kind === 'create') {
        const order = await shopApi.createOrder(action.payload);
        requireSameUser(action.userId, action.epoch);
        orderId = order.id;
        setCreatedOrder({ id: order.id, userId: action.userId });
        clearCheckoutIntent();
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
      if (activeUserId.current === submittedUserId && sessionEpoch.current === epoch)
        window.location.assign(paymentUrl);
    },
    onError: (error, action) => {
      if (activeUserId.current !== action.userId || sessionEpoch.current !== action.epoch) return;
      setFailure({ message: errorText(error), userId: action.userId });
      submitLocked.current = false;
      setSubmittingForUser(null);
    },
  });
  const mutationPending = submitOrder.isPending && submitOrder.variables?.userId === userId;
  const cannotSubmit =
    userId === null ||
    createdOrderId !== null ||
    selectedAddress === null ||
    blocked ||
    couponNeedsValidation ||
    validating ||
    cart.isFetching ||
    addresses.isFetching ||
    submitting ||
    mutationPending;

  if (userId === null)
    return (
      <section className="account-page account-commerce-page">
        <h1>تکمیل خرید</h1>
        <p>
          برای ثبت سفارش <Link to="/login?next=/checkout">ورود کنید</Link>.
        </p>
      </section>
    );
  if (addresses.isLoading || cart.isLoading || addresses.error || cart.error)
    return (
      <section className="account-page account-commerce-page">
        <header className="account-heading">
          <h1>تکمیل خرید</h1>
          <Link to="/cart">بازگشت به سبد خرید</Link>
        </header>
        {addresses.isLoading || cart.isLoading ? (
          <LoadingState layout="form" />
        ) : (
          <ErrorState
            error={addresses.error ?? cart.error}
            onRetry={() => {
              if (addresses.error) void addresses.refetch();
              if (cart.error) void cart.refetch();
            }}
          />
        )}
      </section>
    );

  function submit(event: FormEvent) {
    event.preventDefault();
    // The ref closes the gap before React has rendered the pending mutation state.
    if (
      userId === null ||
      readGuestCart().length > 0 ||
      readGuestTransfer() !== null ||
      selectedAddress === null ||
      submitLocked.current ||
      cannotSubmit ||
      queryClient.isFetching({ queryKey: queryKeys.cart }) > 0 ||
      cartFingerprint(queryClient.getQueryData<CartView>(queryKeys.cart)) !== cartKey ||
      !addresses.data?.some(
        (address) => address.id === selectedAddress && address.userId === userId,
      )
    )
      return;
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
    if (
      userId === null ||
      createdOrderId === null ||
      submitting ||
      submitLocked.current ||
      readGuestCart().length > 0 ||
      readGuestTransfer() !== null
    )
      return;
    submitLocked.current = true;
    setSubmittingForUser(userId);
    setFailure(null);
    submitOrder.mutate({
      kind: 'retry',
      orderId: createdOrderId,
      userId,
      epoch: sessionEpoch.current,
    });
  }

  return (
    <section className="account-page account-commerce-page">
      <header className="account-heading">
        <div>
          <h1>تکمیل خرید</h1>
        </div>
        <Link className="account-secondary-link" to="/cart">
          بازگشت به سبد خرید
        </Link>
      </header>
      <div className="commerce-journey">
        {createdOrderId === null && <ShippingProgress cart={cart.data} />}
        <CommerceSteps current={createdOrderId === null ? 'delivery' : 'payment'} />
      </div>

      {shownFailure && (
        <p role="alert">
          {shownFailure}{' '}
          {shownFailure.includes('خالی') && <Link to="/cart">بازگشت به سبد خرید</Link>}
          {createdOrderId !== null && (
            <Link to={`/orders/${createdOrderId}`}>مشاهدهٔ سفارش ثبت‌شده</Link>
          )}
        </p>
      )}

      <form className="account-checkout-form commerce-checkout-layout" onSubmit={submit}>
        <div className="commerce-checkout-main">
          <fieldset className="account-checkout-addresses">
            <legend>آدرس تحویل</legend>
            {addressList.length === 0 && <p>آدرسی ثبت نکرده‌اید.</p>}
            {addressList.map((address) => (
              <label
                key={address.id}
                className="account-address-option"
                data-selected={selectedAddress === address.id}
              >
                <input
                  type="radio"
                  name="address"
                  value={address.id}
                  checked={selectedAddress === address.id}
                  onChange={() => setAddressId(address.id)}
                />
                <span>
                  <strong>
                    {address.title}
                    {address.isDefault ? ' (پیش‌فرض)' : ''}
                  </strong>
                  <span>
                    {address.receiverName}، {address.city}
                  </span>
                  <span className="account-subtle">{address.fullAddress}</span>
                </span>
              </label>
            ))}
            <Link className="commerce-add-address" to="/addresses/new?next=%2Fcheckout">
              افزودن آدرس جدید
            </Link>
          </fieldset>

          <details
            className="account-checkout-coupon commerce-disclosure"
            open={initialIntent.couponCode !== '' || undefined}
          >
            <summary>کد تخفیف (اختیاری)</summary>
            <fieldset>
              <legend>کد تخفیف</legend>
              <input
                id="checkout-coupon"
                aria-label="کد تخفیف"
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
                placeholder="کد تخفیف را وارد کنید"
              />
              <button
                type="button"
                disabled={!couponCode.trim() || validating || cart.isFetching}
                onClick={() => void validateCoupon()}
              >
                {validating ? 'در حال بررسی…' : 'بررسی کد'}
              </button>
              {validPreview && (
                <p role="status">تخفیف {formatToman(validPreview.discountAmount)} اعمال شد.</p>
              )}
              {couponNeedsValidation && !validating && (
                <p>برای استفاده از کد، ابتدا آن را بررسی کنید.</p>
              )}
            </fieldset>
          </details>

          <details
            className="account-checkout-note commerce-disclosure"
            open={initialIntent.note !== '' || undefined}
          >
            <summary>یادداشت سفارش (اختیاری)</summary>
            <label htmlFor="note">یادداشت سفارش (اختیاری)</label>
            <textarea
              id="note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 500))}
            />
          </details>
        </div>
        <aside className="account-checkout-summary" aria-labelledby="checkout-summary-title">
          <h2 id="checkout-summary-title">خلاصه سفارش</h2>
          {createdOrderId === null ? (
            <>
              <dl className="account-totals">
                <dt>جمع کالاها</dt>
                <dd dir="ltr">{formatToman(itemsTotal)}</dd>
                <dt>تخفیف</dt>
                <dd dir="ltr">{formatToman(discount)}</dd>
                <dt>
                  {shipping.source === 'server' ? 'ارسال (برآورد سامانه)' : 'ارسال (برآورد اولیه)'}
                </dt>
                <dd dir="ltr">{shipping.cost === 0 ? 'رایگان' : formatToman(shipping.cost)}</dd>
                <dt>قابل پرداخت (تخمینی)</dt>
                <dd dir="ltr">{formatToman(payableEstimate)}</dd>
              </dl>
              <p>مبلغ قطعی هنگام ثبت سفارش محاسبه و در رسید ثبت می‌شود.</p>
              <button className="account-submit" type="submit" disabled={cannotSubmit}>
                {submitOrder.isPending ? 'در حال ثبت سفارش…' : 'ثبت سفارش و پرداخت'}
              </button>
            </>
          ) : (
            <>
              <p role="status">سفارش ثبت شده است؛ پرداخت هنوز تأیید نشده است.</p>
              <Link to={`/orders/${createdOrderId}`}>مشاهدهٔ سفارش و مبلغ قطعی</Link>
              <button
                className="account-submit"
                type="button"
                disabled={userId === null || submitting || mutationPending}
                onClick={retryPayment}
              >
                تلاش دوباره برای پرداخت همین سفارش
              </button>
            </>
          )}
        </aside>
      </form>
    </section>
  );
}
