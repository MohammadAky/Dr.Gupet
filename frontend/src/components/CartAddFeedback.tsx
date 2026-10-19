import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/auth-provider';
import { CART_ADDED_EVENT, type CartAddedFeedback } from '../features/cart/cart-feedback';
import { safeImageUrl } from '../lib/image-url';
import { API_BASE_URL } from '../lib/env';
import '../styles/cart-add-feedback.css';

/** A bounded compositor animation, separate from cart data and network state. */
export function CartAddFeedback() {
  const { status, user } = useAuth();
  const { pathname } = useLocation();
  const tileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status === 'loading' || (status === 'authed' && !user)) return;
    const actorId = status === 'authed' ? user!.id : null;
    const tile = tileRef.current;
    if (!tile) return;
    let flight: Animation | undefined;
    let pulse: Animation | undefined;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    let target: HTMLElement | null = null;
    const cleanup = () => {
      clearTimeout(cleanupTimer); flight?.cancel(); pulse?.cancel();
      flight = undefined; pulse = undefined;
      tile.hidden = true; tile.replaceChildren(); target = null;
    };
    const onAdded = (event: Event) => {
      const detail = (event as CustomEvent<CartAddedFeedback>).detail;
      if (!detail || detail.userId !== actorId) return;
      cleanup();
      if (detail.keyboard || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) return;
      target = document.querySelector<HTMLElement>('.cart-link');
      if (!target || !target.isConnected || !target.getClientRects().length) return;
      const end = target.getBoundingClientRect();
      if (end.bottom < 0 || end.top > window.innerHeight || end.width <= 0) return;
      const pulseBasket = () => {
        if (!target?.isConnected || !target.animate) return;
        pulse = target.animate([
          { transform: 'translateY(0) rotate(0) scale(1)' },
          { transform: 'translateY(-4px) rotate(-4deg) scale(1.09)', offset: .24 },
          { transform: 'translateY(-1px) rotate(3deg) scale(1.05)', offset: .5 },
          { transform: 'translateY(0) rotate(-1deg) scale(1.02)', offset: .74 },
          { transform: 'translateY(0) rotate(0) scale(1)' },
        ], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
      };
      const source = detail.source;
      if (!source?.isConnected || !source.getClientRects().length || !tile.animate) { pulseBasket(); return; }
      const start = source.getBoundingClientRect();
      if (start.bottom < 0 || start.top > window.innerHeight || start.width <= 0) { pulseBasket(); return; }
      const img = source.querySelector<HTMLImageElement>('img');
      const url = safeImageUrl(img?.currentSrc || img?.src, window.location.origin, API_BASE_URL);
      if (url) { const copy = document.createElement('img'); copy.src = url; copy.alt = ''; copy.referrerPolicy = 'no-referrer'; tile.append(copy); }
      else tile.textContent = '✓';
      const x = Math.max(0, Math.min(window.innerWidth - 56, start.left + start.width / 2 - 28));
      const y = Math.max(0, Math.min(window.innerHeight - 56, start.top + start.height / 2 - 28));
      const dx = end.left + end.width / 2 - x - 28;
      const dy = end.top + end.height / 2 - y - 28;
      tile.style.left = `${x}px`; tile.style.top = `${y}px`; tile.hidden = false;
      flight = tile.animate([
        { transform: 'translate3d(0,0,0) scale(1)', opacity: .88 },
        { transform: `translate3d(${dx * .45}px,${dy * .45 - 36}px,0) scale(.86)`, opacity: .88, offset: .45 },
        { transform: `translate3d(${dx * .92}px,${dy * .92 - 8}px,0) scale(.46)`, opacity: .7, offset: .84 },
        { transform: `translate3d(${dx}px,${dy}px,0) scale(.24)`, opacity: 0 },
      ], { duration: 640, easing: 'cubic-bezier(.33,0,.2,1)' });
      flight.onfinish = () => { tile.hidden = true; tile.replaceChildren(); pulseBasket(); };
      cleanupTimer = setTimeout(cleanup, 1400);
    };
    window.addEventListener(CART_ADDED_EVENT, onAdded);
    window.addEventListener('pagehide', cleanup);
    window.addEventListener('resize', cleanup);
    window.addEventListener('scroll', cleanup, true);
    const onVisibility = () => { if (document.hidden) cleanup(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.removeEventListener(CART_ADDED_EVENT, onAdded); window.removeEventListener('pagehide', cleanup); window.removeEventListener('resize', cleanup); window.removeEventListener('scroll', cleanup, true); document.removeEventListener('visibilitychange', onVisibility); cleanup(); };
  }, [status, user, pathname]);
  return createPortal(<div ref={tileRef} className="cart-add-flight" hidden aria-hidden="true" />, document.body);
}
