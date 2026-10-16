export const CART_ADDED_EVENT = 'drgupet:cart-added';
export interface CartAddedFeedback { userId: number; keyboard: boolean; source: HTMLElement | null }
/** Transient visual feedback only; callers invoke this after the server confirms the mutation. */
export function signalCartAdded(detail: CartAddedFeedback) {
  window.dispatchEvent(new CustomEvent<CartAddedFeedback>(CART_ADDED_EVENT, { detail }));
}
