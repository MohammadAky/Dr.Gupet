// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { shopApi } from '../api/endpoints-shop';
import { HomePage } from './HomePage';
import { ProductsPage } from './ProductsPage';

vi.mock('../api/endpoints', () => ({ api: { petTypes: vi.fn(), tags: vi.fn() } }));
vi.mock('../api/endpoints-shop', () => ({
  shopApi: {
    categories: vi.fn(),
    products: vi.fn(),
    brands: vi.fn(),
    clinics: vi.fn(),
    clinic: vi.fn(),
    pharmacies: vi.fn(),
    medicines: vi.fn(),
  },
}));
let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
const species = [
  { id: 3, name: 'سگ', slug: 'سگ' },
  { id: 8, name: 'گربه', slug: 'cat' },
  { id: 12, name: 'پرنده', slug: 'bird' },
];
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.petTypes).mockResolvedValue(species);
  vi.mocked(api.tags).mockResolvedValue([
    { id: 21, name: 'بدون گلوتن', slug: 'gluten-free', type: 'DIET' },
  ]);
  vi.mocked(shopApi.categories).mockResolvedValue([]);
  vi.mocked(shopApi.brands).mockResolvedValue([]);
  vi.mocked(shopApi.clinics).mockResolvedValue({ data: [] });
  vi.mocked(shopApi.pharmacies).mockResolvedValue({ data: [] });
  vi.mocked(shopApi.medicines).mockResolvedValue({ data: [] });
  vi.mocked(shopApi.products).mockResolvedValue({
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
});
async function show(element: ReactNode, path = '/') {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
it('offers Persian dog, cat and bird paths using actual API identifiers', async () => {
  await show(<HomePage />);
  expect(
    [...container.querySelectorAll('.landing-species__row a')].map((link) =>
      link.getAttribute('href'),
    ),
  ).toEqual(['/products?petTypeId=3', '/products?petTypeId=8', '/products?petTypeId=12']);
  expect(
    [...container.querySelectorAll('.landing-species__row strong')].map(
      (label) => label.textContent,
    ),
  ).toEqual(['سگ', 'گربه', 'پرنده']);
  expect(
    [...container.querySelectorAll('.landing-species__circle img')].map((image) =>
      image.getAttribute('src'),
    ),
  ).toEqual(['/brand/species-dog.webp', '/brand/species-cat.webp', '/brand/species-bird.webp']);
  expect(container.querySelectorAll('.landing-species__circle svg')).toHaveLength(0);
});
it('does not invent a purchasable species identifier when reference data is missing', async () => {
  vi.mocked(api.petTypes).mockResolvedValue(species.slice(0, 1));
  await show(<HomePage />);
  expect(container.querySelectorAll('.landing-species__row a')).toHaveLength(1);
  expect(container.querySelector('.landing-species__row a')?.getAttribute('href')).toBe(
    '/products?petTypeId=3',
  );
  expect(
    container.querySelector('.landing-species__row a[href="/products?petTypeId=8"]'),
  ).toBeNull();
  expect(
    container.querySelector('.landing-species__row a[href="/products?petTypeId=12"]'),
  ).toBeNull();
});
it('includes later species without hardcoded identifiers or separate category layouts', async () => {
  vi.mocked(api.petTypes).mockResolvedValue([
    ...species,
    { id: 77, name: 'خرگوش', slug: 'rabbit' },
  ]);
  await show(<HomePage />);
  expect(container.querySelectorAll('.landing-species__row a')).toHaveLength(4);
  expect(container.querySelector('.landing-species__row a:last-child')?.getAttribute('href')).toBe(
    '/products?petTypeId=77',
  );
  expect(container.querySelector('.landing-species__row a:last-child')?.textContent).toBe('خرگوش');
  expect(container.querySelector('.landing-species__row a:last-child svg')).not.toBeNull();
  expect(container.querySelector('.landing-species__row a:last-child img')).toBeNull();
});
it('explains unavailable animal categories when the API returns no references', async () => {
  vi.mocked(api.petTypes).mockResolvedValue([]);
  await show(<HomePage />);
  expect(container.querySelectorAll('.landing-species__row a')).toHaveLength(0);
  expect(container.textContent).toContain('دسته‌بندی حیوانات فعلاً در دسترس نیست.');
});
it('applies dietary tags to the API query and resets pagination', async () => {
  await show(<ProductsPage />, '/products?page=3');
  const input = container.querySelector<HTMLInputElement>('.catalog-diet-tags input')!;
  await act(async () => input.click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(shopApi.products).toHaveBeenLastCalledWith(
    expect.objectContaining({ tagIds: '21', page: 1 }),
  );
  expect(input.checked).toBe(true);
});
it('explains missing dietary records rather than presenting an empty unlabeled group', async () => {
  vi.mocked(api.tags).mockResolvedValue([]);
  await show(<ProductsPage />, '/products');
  expect(container.textContent).toContain('ویژگی رژیمی در دسترس نیست.');
});
