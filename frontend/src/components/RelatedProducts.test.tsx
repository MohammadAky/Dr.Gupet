// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { shopApi } from '../api/endpoints-shop';
import type { ProductCard, ProductDetail } from '../api/types';
import { rankRelatedProducts, RelatedProducts } from './RelatedProducts';
vi.mock('../api/endpoints-shop', () => ({ shopApi: { products: vi.fn() } }));
const current: ProductDetail = {
  id: 1, name: 'غذای گربه', slug: 'cat-food', isActive: true, lifeStage: 'ADULT', sizeClass: 'SMALL', neuterSuitability: 'ANY',
  brand: { id: 1, name: 'برند', slug: 'brand' }, category: { id: 2, name: 'غذا', slug: 'food' }, petType: { id: 3, name: 'گربه', slug: 'cat' },
  images: [], variants: [], tags: [], description: null, ingredientsText: null, createdAt: '', updatedAt: '',
};
const card = (id: number, override: Partial<ProductCard> = {}): ProductCard => ({ id, name: `محصول ${id}`, slug: `product-${id}`, brand: { id: 1, name: 'برند' }, image: null, minPrice: 1000, inStock: true, lifeStage: 'ADULT', sizeClass: 'SMALL', ...override });
let container: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
async function show(product = current) { await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter><RelatedProducts product={product} /></MemoryRouter></QueryClientProvider>)); }
it('ranks category first, then exact compatible stage/size and brand; removes current, unavailable, sample and duplicates', () => {
  const category = [card(1), card(2, { lifeStage: 'ALL', sizeClass: 'ALL', brand: { id: 9, name: 'دیگر' } }), card(3), card(4, { inStock: false }), card(5, { isSample: true }), card(6, { lifeStage: 'SENIOR' })];
  const result = rankRelatedProducts(current, category, [card(3), card(7), card(8, { sizeClass: 'LARGE' }), card(9, { slug: 'presentation-v1-food' })]);
  expect(result.map(item => item.id)).toEqual([3, 2, 7]);
});
it('uses only same-pet public catalog calls and actual choice links, without adding products or claiming order history', async () => {
  vi.mocked(shopApi.products).mockImplementation(async filters => ({ data: filters?.categorySlug ? [card(3)] : [card(3), card(7)] }));
  await show(); await vi.waitFor(() => expect(container.querySelectorAll('[data-product-id]')).toHaveLength(2));
  expect(shopApi.products).toHaveBeenCalledWith({ petTypeId: 3, inStock: true, limit: 24, page: 1, lifeStage: 'ADULT', sizeClass: 'SMALL', categorySlug: 'food' });
  expect(shopApi.products).toHaveBeenCalledWith({ petTypeId: 3, inStock: true, limit: 24, page: 1, lifeStage: 'ADULT', sizeClass: 'SMALL' });
  expect(container.querySelector('a[aria-label="انتخاب محصول 3"]')?.getAttribute('href')).toBe('/products/product-3');
  expect(container.querySelector('.landing-carousel__viewport')?.getAttribute('dir')).toBe('rtl');
  expect(container.textContent).not.toContain('خریداران'); expect(container.textContent).not.toContain('افزودن به سبد');
});
it('filters compatible inventory on the server before pagination instead of excluding the first incompatible page afterwards', async () => {
  vi.mocked(shopApi.products).mockImplementation(async filters => ({ data: filters?.lifeStage === 'ADULT' && filters.sizeClass === 'SMALL'
    ? [card(99)] : [card(88, { lifeStage: 'PUPPY_KITTEN', sizeClass: 'LARGE' })] }));
  await show(); await vi.waitFor(() => expect(container.querySelector('[data-product-id="99"]')).not.toBeNull());
  expect(container.querySelector('[data-product-id="88"]')).toBeNull();
});
it('omits ALL filters so an unrestricted product can show any stage and size', async () => {
  vi.mocked(shopApi.products).mockResolvedValue({ data: [card(88, { lifeStage: 'SENIOR', sizeClass: 'LARGE' })] });
  await show({ ...current, lifeStage: 'ALL', sizeClass: 'ALL' });
  await vi.waitFor(() => expect(container.querySelector('[data-product-id="88"]')).not.toBeNull());
  expect(shopApi.products).toHaveBeenCalledTimes(2);
  for (const [filters] of vi.mocked(shopApi.products).mock.calls) {
    expect(filters).not.toHaveProperty('lifeStage'); expect(filters).not.toHaveProperty('sizeClass');
  }
});
it('does not request catalogs for a sample, inactive or invalid current product', async () => {
  for (const product of [{ ...current, isSample: true }, { ...current, isActive: false }, { ...current, id: 0 }, { ...current, petType: { ...current.petType, id: 0 } }, { ...current, brand: { ...current.brand, id: 0 } }]) {
    await show(product); expect(container.querySelector('.related-products')).toBeNull();
  }
  expect(shopApi.products).not.toHaveBeenCalled();
});
it('does not show an older product context when its delayed response finishes after navigating to another animal', async () => {
  let resolve!: (value: { data: ProductCard[] }) => void;
  const old = new Promise<{ data: ProductCard[] }>(done => { resolve = done; });
  vi.mocked(shopApi.products).mockImplementation(filters => filters?.petTypeId === 3 ? old : Promise.resolve({ data: [card(20)] }));
  await show(); await show({ ...current, id: 2, slug: 'dog-food', petType: { id: 4, name: 'سگ', slug: 'dog' } });
  await vi.waitFor(() => expect(container.querySelector('[data-product-id="20"]')).not.toBeNull());
  await act(async () => resolve({ data: [card(30)] }));
  expect(container.querySelector('[data-product-id="30"]')).toBeNull(); expect(container.querySelector('[data-product-id="20"]')).not.toBeNull();
});
it('shows honest empty and recoverable error states without sample substitutions', async () => {
  vi.mocked(shopApi.products).mockResolvedValue({ data: [card(1), card(7, { inStock: false })] });
  await show(); await vi.waitFor(() => expect(container.textContent).toContain('پیدا نشد'));
  vi.mocked(shopApi.products).mockRejectedValue(new Error('ارتباط برقرار نشد'));
  await show({ ...current, id: 9, slug: 'other-food' });
  await vi.waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
  expect(container.querySelector('[data-product-id]')).toBeNull();
});
