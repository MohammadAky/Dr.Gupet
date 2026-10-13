// @vitest-environment jsdom
import { act, lazy, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadingLayoutForPath, PageSkeleton, RouteLoading } from './RouteLoading';
import { LoadingState } from './states';

describe('destination loading outlines', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('selects the destination form, list or detail while keeping nested edit routes as forms', () => {
    for (const path of ['/login', '/verify', '/profile', '/checkout', '/pets/new', '/pets/2/edit', '/addresses/3/edit/']) {
      expect(loadingLayoutForPath(path)).toBe('form');
    }
    for (const path of ['/products/food', '/clinics/3', '/medicines/4', '/pharmacies/2', '/orders/1', '/pets/3/']) {
      expect(loadingLayoutForPath(path)).toBe('detail');
    }
    for (const path of ['/orders', '/cart', '/addresses', '/payment/result']) expect(loadingLayoutForPath(path)).toBe('rows');
    for (const path of ['/products', '/clinics', '/medicines', '/pharmacies', '/favorites']) expect(loadingLayoutForPath(path)).toBe('cards');
  });

  it('announces one real pending state and keeps decorative card outlines out of the accessibility tree', async () => {
    await act(async () => root.render(<PageSkeleton />));
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.loading-wireframe__status')?.textContent).toBe('در حال بارگذاری…');
    expect(container.querySelector('.loading-wireframe__body')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('button,input,a,[role="progressbar"]')).toHaveLength(0);
  });

  it('retains compact in-place operation feedback instead of replacing a working form with a page skeleton', async () => {
    await act(async () => root.render(<LoadingState text="در حال بررسی علاقه‌مندی‌ها…" />));
    expect(container.querySelector('.state-loading')?.textContent).toBe('در حال بررسی علاقه‌مندی‌ها…');
    expect(container.querySelector('.loading-wireframe')).toBeNull();
  });

  it('replaces the route outline as soon as the real chunk resolves, without a delayed loader gate', async () => {
    let resolve!: (value: { default: () => React.JSX.Element }) => void;
    const pending = new Promise<{ default: () => React.JSX.Element }>((done) => { resolve = done; });
    const Page = lazy(() => pending);
    await act(async () => root.render(<Suspense fallback={<RouteLoading pathname="/login" />}><Page /></Suspense>));
    expect(container.querySelector('.loading-wireframe--form')).not.toBeNull();
    await act(async () => { resolve({ default: () => <h1>ورود به حساب</h1> }); await pending; });
    expect(container.querySelector('h1')?.textContent).toBe('ورود به حساب');
    expect(container.querySelector('[aria-busy]')).toBeNull();
    expect(container.querySelector('.landing-bootstrap')).toBeNull();
  });
});
