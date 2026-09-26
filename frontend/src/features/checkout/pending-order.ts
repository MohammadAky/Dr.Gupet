/**
 * The payment callback redirects with `orderNumber` only, while
 * `GET /orders/:id` needs the numeric id (BE-REQ-02). We remember the pair in
 * sessionStorage right before sending the user to the gateway, and fall back to
 * scanning the first page of the orders list when the tab was closed.
 */
const KEY = 'drgupet.pendingOrder';

export interface PendingOrder {
  orderId: number;
  orderNumber: string;
}

export function writePendingOrder(order: PendingOrder): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    // sessionStorage may be unavailable — the list-scan fallback still works.
  }
}

export function readPendingOrder(): PendingOrder | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOrder;
    return typeof parsed.orderId === 'number' && typeof parsed.orderNumber === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function clearPendingOrder(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
