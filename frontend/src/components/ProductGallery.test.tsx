// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProductGallery } from './ProductGallery';
let container: HTMLDivElement, root: Root;
const listeners = { fine: new Set<() => void>(), reduced: new Set<() => void>() };
const media = { fine: { matches: true }, reduced: { matches: false } };
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  media.fine.matches = true; media.reduced.matches = false; listeners.fine.clear(); listeners.reduced.clear();
  vi.stubGlobal('matchMedia', (query: string) => {
    const kind = query.includes('reduced') ? 'reduced' : 'fine';
    return { get matches() { return media[kind].matches; }, addEventListener: (_: string, callback: () => void) => listeners[kind].add(callback), removeEventListener: (_: string, callback: () => void) => listeners[kind].delete(callback) };
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const images = [{ id: 1, safeUrl: '/brand/one.webp' }, { id: 2, safeUrl: '/brand/two.webp' }];
const layer = () => container.querySelector<HTMLDivElement>('.product-gallery__zoom-layer')!;
const button = () => container.querySelector<HTMLButtonElement>('.commerce-gallery-open')!;
async function show(selectedId = 1, onSelect = vi.fn(), onOpen = vi.fn()) { await act(async () => root.render(<ProductGallery images={images} selectedId={selectedId} name="غذا" onSelect={onSelect} onOpen={onOpen} />)); }
async function pointer(type: string, x: number, y: number, kind = 'mouse') {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }); Object.defineProperty(event, 'pointerType', { value: kind });
  await act(async () => button().dispatchEvent(event));
}
async function tick() { await act(async () => vi.advanceTimersByTime(20)); }
it('caches bounds on entry, batches mouse tracking once per frame and clears zoom on leave', async () => {
  await show(); const bounds = vi.spyOn(button(), 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 200, height: 300 } as DOMRect);
  await pointer('pointerover', 60, 95); await pointer('pointermove', 110, 170); await pointer('pointermove', 210, 320);
  expect(bounds).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(1); await tick();
  expect(layer().style.transform).toBe('scale(1.5)'); expect(layer().style.transformOrigin).toBe('100% 100%');
  await pointer('pointerout', 210, 320); expect(layer().style.transform).toBe(''); expect(vi.getTimerCount()).toBe(0);
});
it('never zooms touch/coarse or reduced-motion interactions and reacts to a live preference change', async () => {
  await show(); vi.spyOn(button(), 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 200 } as DOMRect);
  await pointer('pointerover', 40, 40, 'touch'); await tick(); expect(layer().style.transform).toBe('');
  media.fine.matches = false; await pointer('pointerover', 40, 40); await tick(); expect(layer().style.transform).toBe('');
  media.fine.matches = true; await pointer('pointerover', 40, 40); await tick(); expect(layer().style.transform).toBe('scale(1.5)');
  media.reduced.matches = true; await act(async () => listeners.reduced.forEach(callback => callback()));
  expect(layer().style.transform).toBe(''); await pointer('pointerover', 40, 40); await tick(); expect(layer().style.transform).toBe('');
});
it('clears pending work on scrolling, changing images, opening the modal and unmounting', async () => {
  const open = vi.fn(); await show(1, vi.fn(), open); vi.spyOn(button(), 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 200 } as DOMRect);
  await pointer('pointerover', 40, 40); await act(async () => window.dispatchEvent(new Event('scroll'))); expect(vi.getTimerCount()).toBe(0);
  await pointer('pointerover', 40, 40); await show(2); expect(vi.getTimerCount()).toBe(0); expect(layer().style.transform).toBe('');
  await show(1, vi.fn(), open); await act(async () => button().click()); expect(open).toHaveBeenCalledTimes(1);
  expect(listeners.fine.size).toBe(1); expect(listeners.reduced.size).toBe(1);
  vi.spyOn(button(), 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 200 } as DOMRect);
  await pointer('pointerover', 40, 40); expect(vi.getTimerCount()).toBe(1);
  await act(async () => root.render(null)); expect(vi.getTimerCount()).toBe(0);
  expect(listeners.fine.size).toBe(0); expect(listeners.reduced.size).toBe(0);
});
it('retains ordered keyboard-accessible thumbnails and a safe failed-image fallback', async () => {
  const select = vi.fn(); await show(1, select);
  const thumbnails = container.querySelectorAll<HTMLButtonElement>('.product-detail__thumbnails button');
  expect(container.querySelector('.product-gallery__media .product-detail__thumbnails')).not.toBeNull();
  expect(container.textContent).not.toContain('نمایش بزرگ‌تر');
  expect(button().getAttribute('aria-label')).toContain('نمایش');
  expect(thumbnails[0]?.getAttribute('aria-pressed')).toBe('true'); expect(thumbnails[1]?.getAttribute('aria-pressed')).toBe('false');
  await act(async () => thumbnails[1]!.click()); expect(select).toHaveBeenCalledWith(2);
  await act(async () => container.querySelector('.product-detail__media img')!.dispatchEvent(new Event('error')));
  expect(container.querySelector('.product-detail__media [role="img"]')?.getAttribute('aria-label')).toContain('در دسترس نیست');
  expect(layer().style.transform).toBe('');
});
