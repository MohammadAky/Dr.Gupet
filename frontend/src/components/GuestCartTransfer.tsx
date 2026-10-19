import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { requestData } from '../api/client';
import type { CartView } from '../api/types';
import { queryKeys } from '../api/query-keys';
import { useAuth } from '../auth/auth-provider';
import { ConfirmDialog } from './ConfirmDialog';
import {
  readGuestCart,
  useGuestCart,
  useGuestTransferCheckpoint,
} from '../features/cart/guest-cart';
import { transferGuestCart, useGuestCartTransferState } from '../features/cart/guest-cart-transfer';
import '../styles/guest-cart.css';

export const GUEST_CART_HANDOFF_NOTE =
  'پس از ورود، تعداد همین کالاها جایگزین تعداد آن‌ها در سبد حساب می‌شود؛ کالاهای دیگر حفظ می‌شوند.';

/** Mounted once by Shell; navigation never restarts an uncertain additive write. */
export function GuestCartTransfer() {
  const { status, user } = useAuth();
  const actorId = status === 'authed' ? (user?.id ?? null) : null;
  const items = useGuestCart();
  const checkpoint = useGuestTransferCheckpoint();
  const pending = items.length > 0 || checkpoint !== null;
  const state = useGuestCartTransferState();
  const [attempt, setAttempt] = useState(0);
  const [confirmation, setConfirmation] = useState<{
    actorId: number;
    variantId: number;
    decide(approved: boolean): void;
  } | null>(null);
  const current = useRef<number | null>(actorId);
  const client = useQueryClient();
  useLayoutEffect(() => {
    current.current = actorId;
  }, [actorId]);
  useEffect(() => {
    if (actorId === null || !pending) return;
    let cancelled = false;
    let cancelConfirmation: (() => void) | undefined;
    const isCurrent = () => !cancelled && current.current === actorId;
    queueMicrotask(() => {
      if (!isCurrent()) return;
      const api = {
        read: () => requestData<CartView>('/cart', { isCurrent }),
        add: (variantId: number, quantity: number) =>
          requestData<CartView>('/cart/items', {
            method: 'POST',
            body: { variantId, quantity },
            isCurrent,
          }),
        set: (itemId: number, quantity: number) =>
          requestData<CartView>(`/cart/items/${itemId}`, {
            method: 'PATCH',
            body: { quantity },
            isCurrent,
          }),
      };
      void transferGuestCart(
        actorId,
        api,
        isCurrent,
        (cart) => {
          if (isCurrent()) client.setQueryData(queryKeys.cart, cart);
        },
        (variantId) =>
          new Promise<boolean>((resolve) => {
            cancelConfirmation = () => {
              resolve(false);
              setConfirmation((value) => (value?.decide === resolve ? null : value));
            };
            setConfirmation({ actorId, variantId, decide: resolve });
          }),
      )
        .then((cart) => {
          if (!isCurrent() || !cart) return;
          client.setQueryData(queryKeys.cart, cart);
          void client.invalidateQueries({ queryKey: queryKeys.cart });
        })
        .catch(() => {
          /* Transfer state retains the recoverable failure. */
        });
    });
    return () => {
      cancelled = true;
      cancelConfirmation?.();
    };
  }, [actorId, pending, attempt, client]);
  if (actorId === null || !pending) return null;
  const failed = state.actorId === actorId && state.status === 'failed';
  const activeConfirmation = confirmation?.actorId === actorId ? confirmation : null;
  const decide = (approved: boolean) => {
    activeConfirmation?.decide(approved);
    setConfirmation(null);
  };
  return (
    <section className="guest-cart-transfer commerce-glass" aria-label="انتقال سبد مهمان">
      <p>{GUEST_CART_HANDOFF_NOTE}</p>
      {failed ? (
        <>
          <p role="alert">{state.error}</p>
          <button
            type="button"
            className="ui-button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            بررسی دوبارهٔ انتقال
          </button>
        </>
      ) : (
        <p role="status">در حال انتقال سبد و بررسی قیمت و موجودی…</p>
      )}
      <Link to="/cart">مشاهدهٔ سبد</Link>
      <ConfirmDialog
        open={activeConfirmation !== null}
        title="افزودن دوبارهٔ کالا؟"
        description={`«${items.find((item) => item.variantId === activeConfirmation?.variantId)?.productName ?? 'کالا'}» در بررسی تازهٔ سبد حساب نبود؛ نتیجهٔ درخواست قبلی هنوز قطعی نیست. با تأیید شما، سبد دوباره بررسی و در صورت نبودن کالا، افزودن تکرار می‌شود.`}
        confirmLabel="بررسی و افزودن دوباره"
        destructive={false}
        onClose={() => decide(false)}
        onConfirm={() => decide(true)}
      />
    </section>
  );
}

/** No checkout effects, orders, coupon or payment work mounts before transfer. */
export function GuestCartTransferGate({ children }: { children: ReactNode }) {
  const items = useGuestCart();
  const checkpoint = useGuestTransferCheckpoint();
  if (!items.length && checkpoint === null) return children;
  return (
    <section className="account-page account-commerce-page">
      <h1>انتقال سبد خرید</h1>
      <p>سبد مهمان شما حفظ شده است. پس از تکمیل انتقال می‌توانید خرید را ادامه دهید.</p>
      <Link to="/cart">بررسی سبد خرید</Link>
    </section>
  );
}

/** Header merges display counts by variant without claiming server prices. */
export function cartCountWithGuest(server?: CartView) {
  const quantities = new Map((server?.items ?? []).map((item) => [item.variantId, item.quantity]));
  for (const item of readGuestCart()) quantities.set(item.variantId, item.quantity);
  return [...quantities.values()].reduce((sum, count) => sum + count, 0);
}
