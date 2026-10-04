// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { ProductCard } from '../api/types';
import { FavoritesPage } from './FavoritesPage';

const authState = vi.hoisted(() => ({ userId: 1, status: 'authed' }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({ status: authState.status, user: { id: authState.userId } }) }));
vi.mock('../api/endpoints-shop', () => ({ shopApi: { favorites: vi.fn(), removeFavorite: vi.fn() } }));

const card: ProductCard = {
  id: 7, name: 'غذای محبوب', slug: 'favorite-food', brand: { id: 2, name: 'برند' },
  image: null, minPrice: 100_000, inStock: true, lifeStage: 'ALL', sizeClass: 'ALL',
};
const page = (data: ProductCard[]) => ({
  data, meta: { page: 2, limit: 20, total: data.length, totalPages: 2 },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

describe('favorites removal', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  let mounted: boolean;

  async function renderPage(waitForItems = true) {
    await act(async () => {
      root.render(<QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/favorites?page=2']}><FavoritesPage /></MemoryRouter>
      </QueryClientProvider>);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    if (waitForItems) await vi.waitFor(() => expect(container.querySelector('.product-card button')).not.toBeNull());
  }

  beforeEach(() => {
    authState.userId = 1;
    authState.status = 'authed';
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    mounted = true;
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
    vi.mocked(shopApi.favorites).mockResolvedValue(page([card]));
  });

  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps page routing, blocks duplicate removals, and reports failure inline', async () => {
    const pending = deferred<void>();
    vi.mocked(shopApi.removeFavorite).mockReturnValue(pending.promise);
    await renderPage();
    expect(shopApi.favorites).toHaveBeenCalledWith(2);
    const remove = container.querySelector<HTMLButtonElement>('.product-card button')!;
    await act(async () => { remove.click(); remove.click(); });
    expect(shopApi.removeFavorite).toHaveBeenCalledTimes(1);
    expect(shopApi.removeFavorite).toHaveBeenCalledWith(7);
    expect(remove.disabled).toBe(true);
    await act(async () => pending.reject(new Error('حذف علاقه‌مندی انجام نشد')));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('حذف علاقه‌مندی انجام نشد');
    expect(window.alert).not.toHaveBeenCalled();
    expect(remove.disabled).toBe(false);
  });

  it('invalidates the same favorites cache and shows success after a server removal', async () => {
    vi.mocked(shopApi.favorites).mockResolvedValueOnce(page([card])).mockResolvedValueOnce(page([]));
    vi.mocked(shopApi.removeFavorite).mockResolvedValue(undefined);
    await renderPage();
    await act(async () => container.querySelector<HTMLButtonElement>('.product-card button')?.click());
    await vi.waitFor(() => expect(container.querySelector('[role="status"]')?.textContent).toBe('محصول از علاقه‌مندی‌ها حذف شد.'));
    expect(shopApi.favorites).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('بازگشت به صفحهٔ اول');
  });

  it('does not show stale feedback or invalidate a cache after unmount', async () => {
    const pending = deferred<void>();
    vi.mocked(shopApi.removeFavorite).mockReturnValue(pending.promise);
    await renderPage();
    await act(async () => container.querySelector<HTMLButtonElement>('.product-card button')?.click());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => root.unmount());
    mounted = false;
    await act(async () => pending.resolve(undefined));
    expect(invalidate).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('does not fetch or remove private favorites for a guest', async () => {
    authState.status = 'guest';
    await renderPage(false);
    expect(shopApi.favorites).not.toHaveBeenCalled();
    expect(shopApi.removeFavorite).not.toHaveBeenCalled();
  });

  it('does not cache a late favorites list after logout', async () => {
    const pending = deferred<ReturnType<typeof page>>();
    vi.mocked(shopApi.favorites).mockReturnValue(pending.promise);
    await renderPage(false);
    expect(shopApi.favorites).toHaveBeenCalledTimes(1);
    authState.status = 'guest';
    await renderPage(false);
    await act(async () => pending.resolve(page([card])));
    expect(client.getQueryData(queryKeys.favorites(2))).toBeUndefined();
    expect(container.textContent).not.toContain('غذای محبوب');
  });
});
