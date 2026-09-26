import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import { shopApi, type CreateOrderInput } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import { ErrorState, LoadingState } from '../components/states';
import { writePendingOrder } from '../features/checkout/pending-order';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT_COST } from '../lib/constants';
import { formatToman } from '../lib/format';
import { errorText } from '../lib/labels';

/**
 * Checkout (F9): the server computes every amount — this page only collects
 * address/coupon/note, then hands the browser over to the payment gateway.
 */
export function CheckoutPage() {
  const queryClient = useQueryClient();

  const addresses = useQuery({ queryKey: queryKeys.addresses, queryFn: () => api.listAddresses() });
  const cart = useQuery({ queryKey: queryKeys.cart, queryFn: () => shopApi.cart() });

  const [addressId, setAddressId] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const selectedAddress =
    addressId ??
    addresses.data?.find((address) => address.isDefault)?.id ??
    addresses.data?.[0]?.id ??
    null;
  const itemsTotal = cart.data?.itemsTotal ?? 0;
  const discount = preview?.discountAmount ?? 0;
  const shipping = itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_COST;
  const payableEstimate = Math.max(0, itemsTotal - discount + shipping);
  const blocked =
    (cart.data?.items.some((item) => !item.available) ?? false) ||
    (cart.data?.items.length ?? 0) === 0;

  const previewCoupon = useMutation({
    mutationFn: (code: string) => shopApi.validateCoupon(code),
    onSuccess: (result) => setPreview(result),
    onError: (error) => {
      setPreview(null);
      setFailure(errorText(error));
    },
  });

  const submitOrder = useMutation({
    mutationFn: async () => {
      if (selectedAddress === null) throw new Error('ابتدا یک آدرس انتخاب کنید');
      const payload: CreateOrderInput = {
        addressId: selectedAddress,
        couponCode: preview ? preview.code : undefined,
        note: note.trim() ? note.trim() : undefined,
      };
      const order = await shopApi.createOrder(payload);
      writePendingOrder({ orderId: order.id, orderNumber: order.orderNumber });
      const { paymentUrl } = await shopApi.startPayment(order.id);
      return paymentUrl;
    },
    onSuccess: (paymentUrl) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      window.location.assign(paymentUrl);
    },
    onError: (error) => setFailure(errorText(error)),
  });

  if (addresses.isLoading || cart.isLoading) return <LoadingState />;
  if (addresses.error)
    return <ErrorState error={addresses.error} onRetry={() => void addresses.refetch()} />;
  if (cart.error) return <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />;

  function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    submitOrder.mutate();
  }

  return (
    <section>
      <h1>تکمیل خرید</h1>

      {failure && (
        <p role="alert">
          {failure} {failure.includes('خالی') && <Link to="/cart">بازگشت به سبد خرید</Link>}
        </p>
      )}

      <form onSubmit={submit}>
        <fieldset>
          <legend>آدرس تحویل</legend>
          {(addresses.data ?? []).length === 0 && (
            <p>
              آدرسی ثبت نکرده‌اید — <Link to="/addresses/new">افزودن آدرس</Link>
            </p>
          )}
          {(addresses.data ?? []).map((address) => (
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
            onChange={(event) => setCouponCode(event.target.value)}
            placeholder="SUMMER20"
          />
          <button
            type="button"
            disabled={!couponCode.trim() || previewCoupon.isPending}
            onClick={() => previewCoupon.mutate(couponCode.trim())}
          >
            بررسی کد
          </button>
          {preview && <p>تخفیف {formatToman(preview.discountAmount)} اعمال شد.</p>}
        </fieldset>

        <fieldset>
          <legend>خلاصه سفارش</legend>
          <dl>
            <dt>جمع کالاها</dt>
            <dd dir="ltr">{formatToman(itemsTotal)}</dd>
            <dt>تخفیف</dt>
            <dd dir="ltr">{formatToman(discount)}</dd>
            <dt>ارسال (تخمینی)</dt>
            <dd dir="ltr">{shipping === 0 ? 'رایگان' : formatToman(shipping)}</dd>
            <dt>قابل پرداخت (تخمینی)</dt>
            <dd dir="ltr">{formatToman(payableEstimate)}</dd>
          </dl>
          <p>مبلغ نهایی فقط سمت سرور محاسبه و در رسید سفارش ثبت می‌شود.</p>
        </fieldset>

        <label htmlFor="note">یادداشت سفارش (اختیاری)</label>
        <textarea id="note" value={note} onChange={(event) => setNote(event.target.value)} />

        <button
          type="submit"
          disabled={selectedAddress === null || blocked || submitOrder.isPending}
        >
          {submitOrder.isPending ? 'در حال ثبت سفارش…' : 'ثبت سفارش و پرداخت'}
        </button>
      </form>
    </section>
  );
}
