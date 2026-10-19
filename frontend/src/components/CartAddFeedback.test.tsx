// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CartAddFeedback } from './CartAddFeedback';
import { signalCartAdded } from '../features/cart/cart-feedback';

const session = vi.hoisted(() => ({ status: 'authed', user: { id: 42 }, pathname: '/products/food' }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => session }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: session.pathname }) }));

type AnimationStub = { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null };
let root: Root;
let host: HTMLDivElement;
let source: HTMLElement;
let basket: HTMLElement;
let reducedMotion: boolean;
let hidden: boolean;
let animations: { element: HTMLElement; frames: Keyframe[]; options: KeyframeAnimationOptions; animation: AnimationStub }[];
const originalHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');

function visible(element: HTMLElement, rect: Partial<DOMRect> = {}) {
  const bounds = { left: 20, right: 120, top: 100, bottom: 200, width: 100, height: 100, x: 20, y: 100, toJSON: () => ({}), ...rect } as DOMRect;
  vi.spyOn(element, 'getClientRects').mockReturnValue({ 0: bounds, length: 1, item: () => bounds, [Symbol.iterator]: () => [bounds][Symbol.iterator]() });
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(bounds);
}
async function render() { await act(async () => root.render(<CartAddFeedback />)); }
function tile() { return document.querySelector<HTMLDivElement>('.cart-add-flight')!; }
function signal(overrides: Partial<Parameters<typeof signalCartAdded>[0]> = {}) {
  signalCartAdded({ userId: 42, keyboard: false, source, ...overrides });
}

beforeEach(async () => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  session.status = 'authed'; session.user = { id: 42 }; session.pathname = '/products/food';
  reducedMotion = false; hidden = false; animations = [];
  vi.stubGlobal('matchMedia', () => ({ matches: reducedMotion }));
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  vi.stubGlobal('innerWidth', 1024); vi.stubGlobal('innerHeight', 768);
  vi.stubGlobal('Animation', class {});
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, writable: true,
    value: vi.fn(function(this: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
      const animation = { cancel: vi.fn(), onfinish: null };
      animations.push({ element: this, frames, options, animation });
      return animation;
    }) });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  source = document.createElement('div'); source.innerHTML = '<img src="/brand/landing-meal-mobile.webp" alt="غذا" />';
  basket = document.createElement('a'); basket.className = 'cart-link';
  document.body.append(source, basket); visible(source); visible(basket, { left: 850, right: 900, top: 30, bottom: 80, width: 50, height: 50 });
  await render();
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); source.remove(); basket.remove();
  delete (document as unknown as Record<string, unknown>).hidden;
  if (originalHidden) Object.defineProperty(Document.prototype, 'hidden', originalHidden);
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).animate;
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

it('waits for the success signal, flies a decorative image, then pulses the basket and cleans up', () => {
  expect(tile().hidden).toBe(true); expect(animations).toHaveLength(0);
  signal();
  expect(tile().hidden).toBe(false); expect(tile().getAttribute('aria-hidden')).toBe('true');
  expect(tile().querySelector('img')?.alt).toBe('');
  expect(new URL(tile().querySelector('img')!.src).pathname).toBe('/brand/landing-meal-mobile.webp');
  expect(animations).toHaveLength(1); expect(animations[0]!.element).toBe(tile()); expect(animations[0]!.options.duration).toBe(640);
  animations[0]!.animation.onfinish?.();
  expect(tile().hidden).toBe(true); expect(tile().childElementCount).toBe(0);
  expect(animations).toHaveLength(2); expect(animations[1]!.element).toBe(basket); expect(animations[1]!.options.duration).toBe(520);
  vi.advanceTimersByTime(1400);
  expect(animations.every(item => item.animation.cancel.mock.calls.length === 1)).toBe(true);
});
it('accepts a confirmed guest write and ignores feedback from an authenticated account', async () => {
  session.status = 'guest'; await render();
  signal({ userId: 42 }); expect(animations).toHaveLength(0);
  signal({ userId: null }); expect(animations).toHaveLength(1); expect(tile().hidden).toBe(false);
});

it.each(['keyboard', 'reduced-motion', 'hidden-document', 'wrong-account', 'no-basket', 'invisible-basket'] as const)('is quiet for %s', mode => {
  if (mode === 'reduced-motion') reducedMotion = true;
  if (mode === 'hidden-document') hidden = true;
  if (mode === 'no-basket') basket.remove();
  if (mode === 'invisible-basket') vi.mocked(basket.getClientRects).mockReturnValue({ length: 0 } as DOMRectList);
  signal({ keyboard: mode === 'keyboard', userId: mode === 'wrong-account' ? 99 : 42 });
  expect(animations).toHaveLength(0); expect(tile().hidden).toBe(true);
});

it('does not subscribe for a guest account', async () => {
  session.status = 'anon'; await render(); signal();
  expect(animations).toHaveLength(0); expect(tile().hidden).toBe(true);
});

it('uses only a basket pulse if the source was removed during the request', () => {
  source.remove(); signal();
  expect(tile().hidden).toBe(true); expect(animations).toHaveLength(1); expect(animations[0]!.element).toBe(basket);
});

it('never clones an untrusted image URL into the flight tile', () => {
  source.querySelector('img')!.src = 'https://untrusted.example/private.webp'; signal();
  expect(tile().querySelector('img')).toBeNull(); expect(tile().textContent).toBe('✓');
});

it.each(['scroll', 'resize', 'pagehide', 'visibilitychange'] as const)('cancels a flight on %s without a basket pulse', event => {
  signal();
  if (event === 'visibilitychange') { hidden = true; document.dispatchEvent(new Event(event)); }
  else window.dispatchEvent(new Event(event));
  expect(animations[0]!.animation.cancel).toHaveBeenCalledOnce();
  expect(tile().hidden).toBe(true); expect(tile().childElementCount).toBe(0);
  vi.advanceTimersByTime(1000); expect(animations).toHaveLength(1);
});

it.each(['route', 'identity'] as const)('cancels on a changed %s and rejects stale account feedback', async change => {
  signal();
  if (change === 'route') session.pathname = '/cart'; else session.user = { id: 99 };
  await render();
  expect(animations[0]!.animation.cancel).toHaveBeenCalledOnce(); expect(tile().hidden).toBe(true);
  if (change === 'identity') { signal(); expect(animations).toHaveLength(1); }
});

it('keeps repeated success signals bounded to one active tile and one cleanup timer', () => {
  signal(); const first = animations[0]!.animation;
  signal();
  expect(first.cancel).toHaveBeenCalledOnce(); expect(animations).toHaveLength(2);
  expect(document.querySelectorAll('.cart-add-flight')).toHaveLength(1);
  expect(tile().querySelectorAll('img')).toHaveLength(1); expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(1400);
  expect(animations[1]!.animation.cancel).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});

it('removes its portal and listeners, and cancels work on unmount', async () => {
  signal(); const flight = animations[0]!.animation;
  await act(async () => root.unmount());
  expect(flight.cancel).toHaveBeenCalledOnce(); expect(document.querySelector('.cart-add-flight')).toBeNull();
  signal(); expect(animations).toHaveLength(1); expect(vi.getTimerCount()).toBe(0);
});
