// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BackToTop } from './BackToTop';

let root: Root;
let host: HTMLDivElement;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let reduced: boolean;
let mediaListeners: Set<() => void>;
const button = () => host.querySelector<HTMLButtonElement>('button');
function flushFrames(timestamp = 1000) {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach(callback => callback(timestamp));
}
async function scrollTo(y: number) {
  vi.stubGlobal('scrollY', y);
  await act(async () => {
    window.dispatchEvent(new Event('scroll'));
    flushFrames();
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('scrollY', 0);
  vi.stubGlobal('scrollTo', vi.fn());
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  reduced = false;
  mediaListeners = new Set();
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reduced; },
    addEventListener: (_name: string, callback: () => void) => mediaListeners.add(callback),
    removeEventListener: (_name: string, callback: () => void) => mediaListeners.delete(callback),
  }));
  frames = new Map(); nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrame; frames.set(id, callback); return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it('appears only beyond 360px and visibly eases through an intermediate position before reaching the top in 360ms', async () => {
  await act(async () => root.render(<BackToTop />));
  expect(button()).toBeNull();
  await scrollTo(360); expect(button()).toBeNull();
  await scrollTo(361); expect(button()?.getAttribute('aria-label')).toBe('بازگشت به بالا');
  await act(async () => button()?.click());
  expect(window.scrollTo).not.toHaveBeenCalled();
  await act(async () => flushFrames(1180));
  const intermediate = vi.mocked(window.scrollTo).mock.calls[0]![0] as ScrollToOptions;
  expect(intermediate.top).toBeGreaterThan(0);
  expect(intermediate.top).toBeLessThan(361);
  await act(async () => flushFrames(1360));
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
  expect(button()).toBeNull();
  await scrollTo(500); expect(button()).not.toBeNull();
  await scrollTo(0); expect(button()).toBeNull();
});

it('returns directly to the top for reduced motion without scheduling an animated journey', async () => {
  reduced = true;
  vi.stubGlobal('scrollY', 1200);
  await act(async () => root.render(<BackToTop />));
  await act(async () => flushFrames());
  await act(async () => button()?.click());
  expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' });
  expect(frames.size).toBe(0);
  expect(button()).toBeNull();
});

it('cancels its remaining scroll frames when the visitor takes over scrolling', async () => {
  vi.stubGlobal('scrollY', 1200);
  await act(async () => root.render(<BackToTop />));
  await act(async () => flushFrames());
  await act(async () => button()?.click());
  await act(async () => flushFrames(1090));
  expect(frames.size).toBe(1);
  window.dispatchEvent(new Event('wheel'));
  expect(frames.size).toBe(0);
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
  expect(vi.mocked(window.scrollTo).mock.calls[0]![0]).not.toEqual({ top: 0, behavior: 'instant' });
});

it('ends an ongoing journey if reduced motion is enabled and removes preference listeners on unmount', async () => {
  vi.stubGlobal('scrollY', 1200);
  await act(async () => root.render(<BackToTop />));
  await act(async () => flushFrames());
  await act(async () => button()?.click());
  expect(frames.size).toBe(1);
  reduced = true;
  await act(async () => mediaListeners.forEach(callback => callback()));
  expect(frames.size).toBe(0);
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
  expect(button()).toBeNull();
  await act(async () => root.unmount());
  expect(mediaListeners.size).toBe(0);
});

it('handles restored scroll positions and removes listeners plus both visibility and journey frames on unmount', async () => {
  vi.stubGlobal('scrollY', 500);
  const add = vi.spyOn(window, 'addEventListener');
  const remove = vi.spyOn(window, 'removeEventListener');
  await act(async () => root.render(<BackToTop />));
  expect(button()).not.toBeNull();
  const subscription = add.mock.calls.find(([event]) => event === 'scroll')!;
  expect(subscription[2]).toEqual({ passive: true });
  window.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('scroll'));
  expect(frames.size).toBe(1);
  await act(async () => button()?.click());
  expect(frames.size).toBe(2);
  await act(async () => root.unmount());
  expect(remove).toHaveBeenCalledWith('scroll', subscription[1]);
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    expect(remove).toHaveBeenCalledWith(event, add.mock.calls.find(([name]) => name === event)![1]);
  }
  expect(frames.size).toBe(0);
  expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(2);
  expect(mediaListeners.size).toBe(0);
  window.dispatchEvent(new Event('scroll'));
  expect(frames.size).toBe(0);
});
