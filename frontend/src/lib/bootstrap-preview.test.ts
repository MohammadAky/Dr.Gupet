// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapPreviewDelay, mountAfterBootstrapPreview } from './bootstrap-preview';

describe('initial landing preview minimum', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(performance, 'now').mockReturnValue(250);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('subtracts document startup time instead of restarting a full minimum at module readiness', () => {
    expect(bootstrapPreviewDelay('/', 50, 250)).toBe(1000);
    const mount = vi.fn();
    mountAfterBootstrapPreview('/', 50, mount);
    vi.advanceTimersByTime(999);
    expect(mount).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(mount).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1200);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([1200, 5000])('mounts immediately when actual startup already took %ims', (elapsed) => {
    vi.mocked(performance.now).mockReturnValue(50 + elapsed);
    const mount = vi.fn();
    mountAfterBootstrapPreview('/', 50, mount);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['/login', '/products', '/products/food', '/profile', '/clinics'])('does not delay initial deep link %s', (path) => {
    const mount = vi.fn();
    mountAfterBootstrapPreview(path, 50, mount);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not install a recurring route-navigation timer, including a later return to home', () => {
    const mount = vi.fn();
    mountAfterBootstrapPreview('/', 50, mount);
    vi.advanceTimersByTime(1000);
    for (const path of ['/products', '/login', '/?campaign=food', '/']) {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    expect(mount).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('accepts a query-string homepage through pathname without affecting its destination', () => {
    window.history.replaceState(null, '', '/?campaign=food');
    const mount = vi.fn();
    mountAfterBootstrapPreview(window.location.pathname, 50, mount);
    vi.advanceTimersByTime(1000);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('?campaign=food');
  });

  it('cancels a pending initial mount when its entry module is disposed', () => {
    const mount = vi.fn();
    const cancel = mountAfterBootstrapPreview('/', 50, mount);
    expect(vi.getTimerCount()).toBe(1);
    cancel();
    cancel();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1200);
    expect(mount).not.toHaveBeenCalled();
  });

  it('fails open for absent or inconsistent timing markers rather than stalling the page', () => {
    for (const start of [Number.NaN, Number.POSITIVE_INFINITY, -1, 300]) {
      expect(bootstrapPreviewDelay('/', start, 250)).toBe(0);
    }
    expect(bootstrapPreviewDelay('/', 50, Number.NaN)).toBe(0);
  });
});
