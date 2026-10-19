import { useSyncExternalStore } from 'react';
import type { CartView } from '../../api/types';
import { isApiError } from '../../lib/errors';
import {
  beginGuestTransfer,
  GUEST_CART_TRANSFER_LOCK,
  finishGuestTransfer,
  readGuestCart,
  readGuestTransfer,
  setGuestTransferPhase,
} from './guest-cart';

export interface GuestTransferApi {
  read(): Promise<CartView>;
  add(variantId: number, quantity: number): Promise<CartView>;
  set(itemId: number, quantity: number): Promise<CartView>;
}
export type GuestTransferStatus = {
  actorId: number | null;
  status: 'idle' | 'pending' | 'failed';
  error: string;
};
let snapshot: GuestTransferStatus = { actorId: null, status: 'idle', error: '' };
const listeners = new Set<() => void>();
let flight: { actorId: number; promise: Promise<CartView | null> } | null = null;
const update = (next: GuestTransferStatus) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};
export function useGuestCartTransferState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => snapshot,
    () => snapshot,
  );
}

/** Absolute guest quantities replace overlaps; server-only items are untouched.
 * Uncertain additive writes are never automatically repeated: reconcile with
 * a fresh read/PATCH, or ask before a fresh absence check and explicit retry.
 * Cross-device cart writes still need backend issue 38.
 */
export function transferGuestCart(
  actorId: number,
  api: GuestTransferApi,
  isCurrent: () => boolean,
  onVerified?: (cart: CartView) => void,
  confirmMissing?: (variantId: number) => Promise<boolean>,
): Promise<CartView | null> {
  if (flight)
    return flight.promise
      .catch(() => null)
      .then((result) => {
        if (!isCurrent()) throw new Error('نشست تغییر کرد؛ انتقال سبد متوقف شد.');
        return readGuestCart().length || readGuestTransfer()
          ? transferGuestCart(actorId, api, isCurrent, onVerified, confirmMissing)
          : result;
      });
  const assertCurrent = () => {
    if (!isCurrent()) throw new Error('نشست تغییر کرد؛ انتقال سبد متوقف شد.');
  };
  const execute = async () => {
    assertCurrent();
    const checkpoint = beginGuestTransfer(actorId);
    if (!checkpoint) return null;
    const assertTargets = () => {
      assertCurrent();
      const active = readGuestTransfer();
      if (
        active?.id !== checkpoint.id ||
        active.actorId !== actorId ||
        active.rows.length !== checkpoint.rows.length ||
        !checkpoint.rows.every((row) =>
          active.rows.some(
            (current) => current.variantId === row.variantId && current.quantity === row.quantity,
          ),
        )
      )
        throw new Error('تعداد یا اقلام سبد در تب دیگری تغییر کرد؛ دوباره بررسی کنید.');
    };
    update({ actorId, status: 'pending', error: '' });
    for (const original of checkpoint.rows) {
      assertTargets();
      const active = readGuestTransfer();
      if (active?.id !== checkpoint.id || active.actorId !== actorId)
        throw new Error('وضعیت انتقال سبد تغییر کرد.');
      const row = active.rows.find((item) => item.variantId === original.variantId)!;
      const setAbsolute = async (itemId: number) => {
        assertTargets();
        setGuestTransferPhase(checkpoint.id, actorId, row.variantId, 'posting');
        try {
          await api.set(itemId, row.quantity);
          assertTargets();
        } catch (problem) {
          setGuestTransferPhase(
            checkpoint.id,
            actorId,
            row.variantId,
            isApiError(problem) && problem.statusCode >= 400 && problem.statusCode < 500
              ? 'ready'
              : 'uncertain',
          );
          throw problem;
        }
      };
      const server = await api.read();
      assertTargets();
      let item = server.items.find((item) => item.variantId === row.variantId);
      if (!item && row.phase !== 'ready') {
        if (!confirmMissing || !(await confirmMissing(row.variantId)))
          throw new Error(
            'نتیجهٔ افزودن این کالا مشخص نیست. افزودن دوباره فقط با تأیید شما انجام می‌شود.',
          );
        assertTargets();
        // Confirmation never authorizes replay from a stale read. Reconcile
        // again under the same cross-tab lock before any additional POST.
        const refreshed = await api.read();
        assertTargets();
        item = refreshed.items.find((item) => item.variantId === row.variantId);
        if (!item) setGuestTransferPhase(checkpoint.id, actorId, row.variantId, 'ready');
      }
      if (item) {
        if (item.quantity !== row.quantity) {
          await setAbsolute(item.id);
        }
      } else {
        assertTargets();
        setGuestTransferPhase(checkpoint.id, actorId, row.variantId, 'posting');
        try {
          await api.add(row.variantId, row.quantity);
          assertTargets();
        } catch (problem) {
          if (isApiError(problem) && problem.statusCode >= 400 && problem.statusCode < 500) {
            setGuestTransferPhase(checkpoint.id, actorId, row.variantId, 'ready');
            throw problem;
          }
          // Persist uncertainty even after logout; this checkpoint belongs only
          // to its original actor and cannot be replayed into another account.
          setGuestTransferPhase(checkpoint.id, actorId, row.variantId, 'uncertain');
          assertTargets();
          const reconciled = await api.read();
          assertTargets();
          const applied = reconciled.items.find((item) => item.variantId === row.variantId);
          if (!applied) throw problem;
          if (applied.quantity !== row.quantity) {
            await setAbsolute(applied.id);
          }
        }
      }
      assertTargets();
      setGuestTransferPhase(checkpoint.id, actorId, row.variantId, 'done');
    }
    const result = await api.read();
    assertTargets();
    if (
      !checkpoint.rows.every((row) =>
        result.items.some(
          (item) => item.variantId === row.variantId && item.quantity === row.quantity,
        ),
      )
    )
      throw new Error('سبد حساب هم‌زمان تغییر کرده است؛ دوباره بررسی کنید.');
    onVerified?.(result);
    assertTargets();
    finishGuestTransfer(checkpoint.id, actorId);
    update({ actorId, status: 'idle', error: '' });
    return result;
  };
  const promise = (async () => {
    // Web Locks serialize same-origin tabs; a fallback cannot honestly promise
    // exclusion around an additive POST when storage has no compare-and-swap.
    if (!navigator.locks?.request)
      throw new Error(
        'انتقال امن سبد در این مرورگر پشتیبانی نمی‌شود. از مرورگر به‌روز استفاده کنید.',
      );
    return navigator.locks.request(GUEST_CART_TRANSFER_LOCK, async () => execute());
  })()
    .catch((problem: unknown) => {
      if (isCurrent())
        update({
          actorId,
          status: 'failed',
          error: problem instanceof Error ? problem.message : 'انتقال سبد انجام نشد.',
        });
      throw problem;
    })
    .finally(() => {
      if (flight?.promise === promise) flight = null;
    });
  flight = { actorId, promise };
  return promise;
}
