/**
 * Business constants mirrored from the backend (README §9.6 and backend/.env).
 * They are used for UI estimates only — the server always computes the payable
 * amount (BE-REQ-04: GET /cart returns itemsTotal only).
 */
export const MAX_ADDRESSES_PER_USER = 10;
export const MAX_PETS_PER_USER = 10;
export const MAX_CART_ITEM_QTY = 20;
export const LOW_STOCK_THRESHOLD = 5;
export const SHIPPING_FLAT_COST = 50_000;
export const FREE_SHIPPING_THRESHOLD = 1_500_000;
export const ORDER_EXPIRE_MINUTES = 30;
export const OTP_TTL_SECONDS = 120;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const MAX_PAGE_LIMIT = 50;
export const DEFAULT_PAGE_LIMIT = 20;
export const UPLOAD_MAX_MB = 5;
export const UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function shippingEstimate(itemsTotal: number): number {
  return itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_COST;
}
