// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { shopApi } from '../api/endpoints-shop';
import { ProductsPage } from './ProductsPage';

vi.mock('../api/endpoints', () => ({ api: { petTypes: vi.fn() } }));
vi.mock('../api/endpoints-shop', () => ({ shopApi: { brands: vi.fn(), products: vi.fn() } }));

describe('catalog URL forms', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(api.petTypes).mockResolvedValue([]);
    vi.mocked(shopApi.brands).mockResolvedValue([]);
    vi.mocked(shopApi.products).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('updates search and price drafts when navigation changes URL filters', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/products?q=dog&minPrice=100']}>
            <Link to="/products?q=cat&minPrice=200">other filter</Link>
            <Routes>
              <Route path="/products" element={<ProductsPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    expect((container.querySelector('#q') as HTMLInputElement).value).toBe('dog');
    expect((container.querySelector('#minPrice') as HTMLInputElement).value).toBe('100');

    await act(async () => (container.querySelector('a') as HTMLAnchorElement).click());

    expect((container.querySelector('#q') as HTMLInputElement).value).toBe('cat');
    expect((container.querySelector('#minPrice') as HTMLInputElement).value).toBe('200');
  });
});
