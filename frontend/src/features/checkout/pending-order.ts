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

function isPendingOrder(value: unknown): value is PendingOrder {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<PendingOrder>;
  return typeof candidate.orderId === 'number' && Number.isSafeInteger(candidate.orderId) &&
    candidate.orderId > 0 && typeof candidate.orderNumber === 'string' &&
    candidate.orderNumber.trim().length > 0;
}

export function writePendingOrder(order: PendingOrder): void {
  if (!isPendingOrder(order)) return;
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
    const parsed: unknown = JSON.parse(raw);
    return isPendingOrder(parsed) ? parsed : null;
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
