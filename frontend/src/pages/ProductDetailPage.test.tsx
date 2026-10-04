// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { CartView, ProductDetail } from '../api/types';
import { useAuth } from '../auth/auth-provider';
import { ProductDetailPage } from './ProductDetailPage';

vi.mock('../api/endpoints-shop', () => ({ shopApi: {
  product: vi.fn(), favorites: vi.fn(), addCartItem: vi.fn(),
  addFavorite: vi.fn(), removeFavorite: vi.fn(),
} }));
vi.mock('../auth/auth-provider', () => ({ useAuth: vi.fn() }));

const detail: ProductDetail = {
  id: 1, name: 'غذای سگ', slug: 'dog-food', description: null, ingredientsText: null,
  lifeStage: 'ADULT', sizeClass: 'ALL', neuterSuitability: 'ANY', isActive: true,
  createdAt: '', updatedAt: '',
  brand: { id: 2, name: 'برند', slug: 'brand' },
  category: { id: 3, name: 'غذا', slug: 'food' },
  petType: { id: 4, name: 'سگ', slug: 'dog' },
  images: [], tags: [],
  variants: [
    { id: 11, sku: 'dog-1', weightGram: 1000, price: 100_000,
      compareAtPrice: null, inStock: true, lowStock: false },
    { id: 12, sku: 'dog-2', weightGram: 2000, price: 200_000,
      compareAtPrice: null, inStock: false, lowStock: false },
  ],
};
const cartView: CartView = { items: [], itemsTotal: 0 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

async function changeInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('product detail private actions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  let mounted: boolean;

  function renderPage() {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/products/dog-food']}>
          <Routes><Route path="/products/:slug" element={<ProductDetailPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  function submitForm() {
    container.querySelector('form')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.resetAllMocks();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    mounted = true;
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(useAuth).mockReturnValue({ status: 'authed', user: { id: 7 } } as ReturnType<typeof useAuth>);
    vi.mocked(shopApi.product).mockResolvedValue(detail);
    vi.mocked(shopApi.favorites).mockResolvedValue({ data: [] });
    vi.mocked(shopApi.addCartItem).mockResolvedValue(cartView);
    vi.mocked(shopApi.addFavorite).mockResolvedValue(undefined);
    vi.mocked(shopApi.removeFavorite).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
  });

  async function showPage() {
    await act(async () => renderPage());
    await vi.waitFor(() => expect(container.querySelector('#qty')).not.toBeNull());
  }

  it('keeps guest cart and favorite requests private', async () => {
    vi.mocked(useAuth).mockReturnValue({ status: 'guest', user: null } as ReturnType<typeof useAuth>);
    await showPage();
    expect(shopApi.favorites).not.toHaveBeenCalled();
    expect(container.textContent).toContain('برای افزودن به سبد خرید وارد شوید');
    await act(async () => submitForm());
    expect(shopApi.addCartItem).not.toHaveBeenCalled();
    expect(shopApi.addFavorite).not.toHaveBeenCalled();
  });

  it('rejects fractional/out-of-range quantities and sends one integer request per submit', async () => {
    const pending = deferred<CartView>();
    vi.mocked(shopApi.addCartItem).mockReturnValue(pending.promise);
    await showPage();
    const qty = container.querySelector<HTMLInputElement>('#qty')!;
    expect(qty.step).toBe('1');
    await changeInput(qty, '1.5');
    expect(qty.value).toBe('1.5');
    expect(qty.getAttribute('aria-invalid')).toBe('true');
    await act(async () => submitForm());
    expect(shopApi.addCartItem).not.toHaveBeenCalled();
    await changeInput(qty, '21');
    await act(async () => submitForm());
    expect(shopApi.addCartItem).not.toHaveBeenCalled();
    await changeInput(qty, '2');
    await act(async () => { submitForm(); submitForm(); });
    expect(shopApi.addCartItem).toHaveBeenCalledTimes(1);
    expect(shopApi.addCartItem).toHaveBeenCalledWith(11, 2);
    await act(async () => pending.resolve(cartView));
    expect(container.textContent).toContain('به سبد خرید اضافه شد.');
  });

  it('does not submit an unavailable selected variant', async () => {
    await showPage();
    await act(async () => {
      const unavailable = container.querySelector<HTMLInputElement>('input[value="12"]')!;
      unavailable.click();
    });
    await act(async () => submitForm());
    expect(shopApi.addCartItem).not.toHaveBeenCalled();
  });

  it('ignores an old cart response after account switch and permits the new account request', async () => {
    const oldRequest = deferred<CartView>();
    const newRequest = deferred<CartView>();
    vi.mocked(shopApi.addCartItem)
      .mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    const invalidation = vi.spyOn(client, 'invalidateQueries');
    await showPage();
    await act(async () => submitForm());
    vi.mocked(useAuth).mockReturnValue({ status: 'authed', user: { id: 8 } } as ReturnType<typeof useAuth>);
    await act(async () => renderPage());
    await act(async () => submitForm());
    expect(shopApi.addCartItem).toHaveBeenCalledTimes(2);
    await act(async () => oldRequest.resolve(cartView));
    expect(invalidation).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('به سبد خرید اضافه شد.');
    await act(async () => newRequest.resolve(cartView));
    expect(invalidation).toHaveBeenCalledWith({ queryKey: queryKeys.cart });
  });

  it('drops late favorite errors after account change without invalidating the next account cache', async () => {
    const pending = deferred<void>();
    vi.mocked(shopApi.addFavorite).mockReturnValue(pending.promise);
    const invalidation = vi.spyOn(client, 'invalidateQueries');
    await showPage();
    await act(async () => {
      const favorite = [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('افزودن به علاقه‌مندی‌ها'))!;
      favorite.click();
      favorite.click();
    });
    expect(shopApi.addFavorite).toHaveBeenCalledTimes(1);
    vi.mocked(useAuth).mockReturnValue({ status: 'guest', user: null } as ReturnType<typeof useAuth>);
    await act(async () => renderPage());
    await act(async () => pending.reject(new Error('old account')));
    expect(invalidation).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('old account');
  });

  it('does not invalidate cart data for a late response after unmount', async () => {
    const pending = deferred<CartView>();
    vi.mocked(shopApi.addCartItem).mockReturnValue(pending.promise);
    const invalidation = vi.spyOn(client, 'invalidateQueries');
    await showPage();
    await act(async () => submitForm());
    await act(async () => root.unmount());
    mounted = false;
    await act(async () => pending.resolve(cartView));
    expect(invalidation).not.toHaveBeenCalled();
  });

  it('does not store a late private favorites response after becoming a guest', async () => {
    const pending = deferred<Awaited<ReturnType<typeof shopApi.favorites>>>();
    vi.mocked(shopApi.favorites).mockReturnValue(pending.promise);
    await showPage();
    vi.mocked(useAuth).mockReturnValue({ status: 'guest', user: null } as ReturnType<typeof useAuth>);
    await act(async () => renderPage());
    await act(async () => pending.resolve({ data: [] }));
    expect(client.getQueryData(queryKeys.favorites(1))).toBeUndefined();
  });
});
