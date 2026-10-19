import { useSyncExternalStore } from 'react';
import type { ProductDetail, ProductVariant } from '../../api/types';
import { isSampleProduct, publicRecordName } from '../../lib/sample-records';
import { MAX_CART_ITEM_QTY } from '../../lib/constants';
import { API_BASE_URL } from '../../lib/env';
import { safeImageUrl } from '../../lib/image-url';

export const GUEST_CART_KEY = 'drgupet.guest-cart.v1';
export const GUEST_CART_TRANSFER_LOCK = 'drgupet-guest-cart-transfer';
export interface GuestCartItem {
  variantId: number;
  quantity: number;
  productId: number;
  productName: string;
  productSlug: string;
  productImage: string | null;
  weightGram: number;
  unitPrice: number;
}
export type TransferPhase = 'ready' | 'posting' | 'uncertain' | 'done';
export interface GuestTransferCheckpoint {
  id: string;
  actorId: number;
  rows: Array<{ variantId: number; quantity: number; phase: TransferPhase }>;
}
interface GuestState {
  version: 1;
  items: readonly GuestCartItem[];
  transfer: GuestTransferCheckpoint | null;
}
const EMPTY: GuestState = { version: 1, items: [], transfer: null };
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined,
  cached: GuestState = EMPTY;
const integer = (value: unknown, minimum = 0): value is number =>
  Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= 2_147_483_647;
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= max &&
  [...value].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127);

function guestImagePath(value: string | null): string | null {
  // Validate before URL normalization can erase traversal, query or fragment
  // syntax. Uploaded UUID paths need no percent-encoded segments.
  if (!value || value.length > 500 || value.includes('..') || /[?#%]/.test(value)) return null;
  const safe = safeImageUrl(value, window.location.origin, API_BASE_URL);
  if (!safe) return null;
  const url = new URL(safe);
  return ['http:', 'https:'].includes(url.protocol) &&
    /^\/(?:uploads|brand)\/[a-zA-Z0-9_./-]+$/.test(url.pathname)
    ? url.pathname
    : null;
}

/** Storage is an untrusted display draft, never a price, stock or payment authority. */
function parse(raw: string | null): GuestState {
  if (!raw || raw.length > 150_000) return EMPTY;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.version !== 1 || !Array.isArray(value.items) || value.items.length > 100)
      return EMPTY;
    const ids = new Set<number>();
    const items: GuestCartItem[] = [];
    for (const row of value.items) {
      if (
        !row ||
        !integer(row.variantId, 1) ||
        ids.has(row.variantId) ||
        !integer(row.quantity, 1) ||
        row.quantity > MAX_CART_ITEM_QTY ||
        !integer(row.productId, 1) ||
        !text(row.productName, 191) ||
        !text(row.productSlug, 191) ||
        !/^[\p{L}\p{N}_-]+$/u.test(row.productSlug) ||
        row.productSlug.startsWith('presentation-v1-') ||
        !integer(row.weightGram) ||
        !integer(row.unitPrice) ||
        !(
          row.productImage === null ||
          (text(row.productImage, 500) &&
            /^\/(?:uploads|brand)\/[a-zA-Z0-9_./-]+$/.test(row.productImage) &&
            !row.productImage.includes('..'))
        )
      )
        return EMPTY;
      ids.add(row.variantId);
      items.push(
        Object.freeze({
          variantId: row.variantId,
          quantity: row.quantity,
          productId: row.productId,
          productName: row.productName,
          productSlug: row.productSlug,
          productImage: row.productImage,
          weightGram: row.weightGram,
          unitPrice: row.unitPrice,
        }),
      );
    }
    let transfer: GuestTransferCheckpoint | null = null;
    if (value.transfer != null) {
      const pending = value.transfer as GuestTransferCheckpoint;
      if (
        !text(pending.id, 100) ||
        !integer(pending.actorId, 1) ||
        !Array.isArray(pending.rows) ||
        pending.rows.length !== items.length ||
        !items.length
      )
        return EMPTY;
      const claims = new Set<number>();
      for (const row of pending.rows) {
        if (
          !row ||
          claims.has(row.variantId) ||
          !['ready', 'posting', 'uncertain', 'done'].includes(row.phase) ||
          !items.some((item) => item.variantId === row.variantId && item.quantity === row.quantity)
        )
          return EMPTY;
        claims.add(row.variantId);
      }
      transfer = {
        id: pending.id,
        actorId: pending.actorId,
        rows: pending.rows.map((row) => ({
          variantId: row.variantId,
          quantity: row.quantity,
          phase: row.phase,
        })),
      };
    }
    return { version: 1, items: Object.freeze(items), transfer };
  } catch {
    return EMPTY;
  }
}
function state(): GuestState {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(GUEST_CART_KEY);
  } catch {
    return cached;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}
function save(next: GuestState) {
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(GUEST_CART_KEY, raw);
  } catch {
    throw new Error('ذخیرهٔ سبد در این مرورگر ممکن نشد. تنظیمات ذخیره‌سازی مرورگر را بررسی کنید.');
  }
  cachedRaw = raw;
  cached = parse(raw);
  listeners.forEach((listener) => listener());
}
export function subscribeGuestCart(listener: () => void) {
  listeners.add(listener);
  const changed = (event: StorageEvent) => {
    if (event.key === GUEST_CART_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', changed);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', changed);
  };
}
export const readGuestCart = (): readonly GuestCartItem[] => state().items;
export const readGuestTransfer = (): GuestTransferCheckpoint | null => state().transfer;
export function useGuestCart() {
  return useSyncExternalStore(subscribeGuestCart, readGuestCart, () => EMPTY.items);
}
export function useGuestTransferCheckpoint() {
  return useSyncExternalStore(subscribeGuestCart, readGuestTransfer, () => null);
}
function editable() {
  const current = state();
  if (current.transfer) throw new Error('ابتدا انتقال سبد مهمان را تکمیل کنید.');
  return current;
}
function quantity(value: number) {
  if (!integer(value, 1) || value > MAX_CART_ITEM_QTY)
    throw new Error(
      `تعداد هر کالا باید بین ۱ و ${MAX_CART_ITEM_QTY.toLocaleString('fa-IR')} باشد.`,
    );
}
export function addGuestCartItem(
  detail: ProductDetail,
  candidate: ProductVariant,
  count: number,
): void {
  quantity(count);
  const variant = detail.variants.find((row) => row.id === candidate.id);
  if (!detail.isActive || isSampleProduct(detail) || !variant?.inStock || !integer(variant.id, 1))
    throw new Error('این کالا در حال حاضر قابل خرید نیست.');
  const current = editable();
  const previous = current.items.find((row) => row.variantId === variant.id);
  const nextQuantity = (previous?.quantity ?? 0) + count;
  quantity(nextQuantity);
  if (!previous && current.items.length >= 100) throw new Error('سبد به سقف ۱۰۰ قلم رسیده است.');
  const first = [...detail.images].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url ?? null;
  const image = guestImagePath(first);
  const item: GuestCartItem = {
    variantId: variant.id,
    quantity: nextQuantity,
    productId: detail.id,
    productName: publicRecordName(detail),
    productSlug: detail.slug,
    productImage: image,
    weightGram: variant.weightGram,
    unitPrice: variant.price,
  };
  const next = {
    ...current,
    items: [...current.items.filter((row) => row.variantId !== item.variantId), item],
  };
  if (parse(JSON.stringify(next)).items.length !== next.items.length)
    throw new Error('اطلاعات محصول برای افزودن به سبد معتبر نیست.');
  save(next);
}
export function setGuestCartQuantity(variantId: number, count: number) {
  quantity(count);
  const current = editable();
  save({
    ...current,
    items: current.items.map((row) =>
      row.variantId === variantId ? { ...row, quantity: count } : row,
    ),
  });
}
export function removeGuestCartItem(variantId: number) {
  const current = editable();
  save({ ...current, items: current.items.filter((row) => row.variantId !== variantId) });
}
export function clearGuestCart() {
  const current = editable();
  save({ ...current, items: [] });
}
export function beginGuestTransfer(actorId: number): GuestTransferCheckpoint | null {
  if (!integer(actorId, 1)) throw new Error('حساب کاربری معتبر نیست.');
  const current = state();
  if (current.transfer) {
    if (current.transfer.actorId !== actorId)
      throw new Error('این سبد در حال انتقال به حساب دیگری است؛ برای ادامه وارد همان حساب شوید.');
    return current.transfer;
  }
  if (!current.items.length) return null;
  const transfer: GuestTransferCheckpoint = {
    id: crypto.randomUUID(),
    actorId,
    rows: current.items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      phase: 'ready',
    })),
  };
  save({ ...current, transfer });
  return transfer;
}
export function setGuestTransferPhase(
  id: string,
  actorId: number,
  variantId: number,
  phase: TransferPhase,
) {
  const current = state();
  if (current.transfer?.id !== id || current.transfer.actorId !== actorId)
    throw new Error('وضعیت انتقال سبد تغییر کرده است.');
  save({
    ...current,
    transfer: {
      ...current.transfer,
      rows: current.transfer.rows.map((row) =>
        row.variantId === variantId ? { ...row, phase } : row,
      ),
    },
  });
}
export function finishGuestTransfer(id: string, actorId: number) {
  const current = state();
  if (
    current.transfer?.id !== id ||
    current.transfer.actorId !== actorId ||
    current.transfer.rows.some((row) => row.phase !== 'done')
  )
    throw new Error('انتقال سبد هنوز کامل نشده است.');
  save({ version: 1, items: [], transfer: null });
}

/** Only definitely un-applied/rejected rows may be edited during recovery. */
export async function editGuestTransferItem(
  actorId: number,
  variantId: number,
  count: number | null,
) {
  if (count !== null) quantity(count);
  if (!navigator.locks?.request) throw new Error('ویرایش امن سبد در این مرورگر پشتیبانی نمی‌شود.');
  await navigator.locks.request(GUEST_CART_TRANSFER_LOCK, { ifAvailable: true }, (lock) => {
    if (!lock)
      throw new Error('انتقال سبد در تب دیگری در حال انجام است؛ پس از پایان آن دوباره بررسی کنید.');
    const current = state(),
      transfer = current.transfer;
    if (
      !transfer ||
      transfer.actorId !== actorId ||
      transfer.rows.find((row) => row.variantId === variantId)?.phase !== 'ready'
    )
      throw new Error('این ردیف تا روشن‌شدن نتیجهٔ انتقال قابل تغییر نیست.');
    const items =
      count === null
        ? current.items.filter((row) => row.variantId !== variantId)
        : current.items.map((row) =>
            row.variantId === variantId ? { ...row, quantity: count } : row,
          );
    const rows =
      count === null
        ? transfer.rows.filter((row) => row.variantId !== variantId)
        : transfer.rows.map((row) =>
            row.variantId === variantId ? { ...row, quantity: count } : row,
          );
    save({ ...current, items, transfer: rows.length ? { ...transfer, rows } : null });
  });
}
