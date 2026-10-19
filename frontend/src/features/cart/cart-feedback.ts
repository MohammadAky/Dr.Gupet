export const CART_ADDED_EVENT = 'drgupet:cart-added';
export interface CartAddedFeedback { userId: number | null; keyboard: boolean; source: HTMLElement | null }
/** Transient feedback after a confirmed server mutation or durable guest-cart write. */
export function signalCartAdded(detail: CartAddedFeedback) {
  window.dispatchEvent(new CustomEvent<CartAddedFeedback>(CART_ADDED_EVENT, { detail }));
}
