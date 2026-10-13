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
    expect((container.querySelector('#minPrice') as HTMLInputElement).value).toBe('۱۰۰');

    await act(async () => (container.querySelector('a') as HTMLAnchorElement).click());

    expect((container.querySelector('#q') as HTMLInputElement).value).toBe('cat');
    expect((container.querySelector('#minPrice') as HTMLInputElement).value).toBe('۲۰۰');
  });

  it('formats price filters while preserving API Toman values and rejecting exponent syntax', async () => {
    await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/products']}><ProductsPage /></MemoryRouter></QueryClientProvider>));
    async function edit(id: string, value: string) {
      await act(async () => {
        const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    await edit('minPrice', '۱۲۳٬۰۰۰'); await edit('maxPrice', '456000');
    expect(container.querySelector<HTMLInputElement>('#maxPrice')!.value).toBe('۴۵۶٬۰۰۰');
    await act(async () => container.querySelector('.price-filter')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await vi.waitFor(() => expect(shopApi.products).toHaveBeenCalledWith(expect.objectContaining({ minPrice: 123000, maxPrice: 456000 })));
    const calls = vi.mocked(shopApi.products).mock.calls.length;
    await edit('minPrice', '1e3');
    await act(async () => container.querySelector('.price-filter')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(container.querySelector('#price-filter-error')).not.toBeNull();
    expect(vi.mocked(shopApi.products).mock.calls.length).toBe(calls);
  });
});
