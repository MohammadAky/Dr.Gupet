// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { shopApi } from '../api/endpoints-shop';
import type { ProductCard } from '../api/types';
import { ProductsPage } from './ProductsPage';
vi.mock('../api/endpoints', () => ({ api: { petTypes: vi.fn(), tags: vi.fn() } }));
vi.mock('../api/endpoints-shop', () => ({ shopApi: { brands: vi.fn(), products: vi.fn() } }));
vi.mock('../components/ProductCardView', () => ({ ProductCardView: ({ card }: { card: ProductCard }) => <article data-product-id={card.id}>{card.name}</article> }));
const card = (id: number) => ({ id, name: `محصول ${id}` }) as ProductCard;
const page = (ids: number[], number = 1, pages = 1) => ({ data: ids.map(card), meta: { page: number, limit: 24, total: 48, totalPages: pages } });
let container: HTMLDivElement, root: Root, client: QueryClient;
let observers: { callback: IntersectionObserverCallback; disconnected: boolean }[];
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); }
async function render(path = '/products') {
  await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>
    <Link to="/products?q=cat&minPrice=200">other filter</Link><ProductsPage />
  </MemoryRouter></QueryClientProvider>));
  await flush();
}
function button(text: string) { return [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.startsWith(text))!; }
async function click(text: string) { await act(async () => button(text).click()); await flush(); }
async function intersect() {
  const observer = [...observers].reverse().find(item => !item.disconnected)!;
  await act(async () => observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  await flush();
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  observers = [];
  vi.stubGlobal('IntersectionObserver', class {
    record: { callback: IntersectionObserverCallback; disconnected: boolean };
    constructor(callback: IntersectionObserverCallback) { this.record = { callback, disconnected: false }; observers.push(this.record); }
    observe() {} disconnect() { this.record.disconnected = true; }
  });
  container = document.createElement('div'); container.id = 'root'; document.body.append(container); root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  vi.mocked(api.petTypes).mockResolvedValue([{ id: 1, name: 'گربه', slug: 'cat' }]);
  vi.mocked(api.tags).mockResolvedValue([]); vi.mocked(shopApi.brands).mockResolvedValue([{ id: 7, name: 'برند تست', slug: 'test', logo: null, country: null }]);
  vi.mocked(shopApi.products).mockResolvedValue(page([]));
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('catalog filters', () => {
  it('uses navbar search URL and updates price drafts on browser navigation, without a duplicate search form', async () => {
    await render('/products?q=dog&minPrice=100');
    expect(container.querySelector('.catalog-search')).toBeNull();
    expect(container.textContent).toContain('dog');
    expect(container.querySelector<HTMLInputElement>('[name=minPrice]')!.value).toBe('۱۰۰');
    await act(async () => container.querySelector('a')!.click()); await flush();
    expect(container.textContent).toContain('cat');
    expect(container.querySelector<HTMLInputElement>('[name=minPrice]')!.value).toBe('۲۰۰');
    expect(shopApi.products).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'cat', page: 1, limit: 24, minPrice: 200 }));
  });
  it('opens only one compact section and retains the selected animal after another section opens', async () => {
    await render();
    expect(container.querySelectorAll('[aria-expanded=true]')).toHaveLength(0);
    await click('نوع حیوان');
    const cat = container.querySelector<HTMLInputElement>('input[type=radio][value="1"]')!;
    await act(async () => cat.click()); await flush();
    await click('برند');
    expect(button('نوع حیوان').getAttribute('aria-expanded')).toBe('false');
    expect(button('برند').getAttribute('aria-expanded')).toBe('true'); expect(cat.checked).toBe(true);
    expect(shopApi.products).toHaveBeenLastCalledWith(expect.objectContaining({ petTypeId: 1, page: 1 }));
  });
  it('formats Toman filters and rejects exponent syntax', async () => {
    await render(); await click('محدودهٔ قیمت');
    async function edit(name: string, value: string) {
      await act(async () => {
        const input = container.querySelector<HTMLInputElement>(`[name=${name}]`)!;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    await edit('minPrice', '۱۲۳٬۰۰۰'); await edit('maxPrice', '456000');
    expect(container.querySelector<HTMLInputElement>('[name=maxPrice]')!.value).toBe('۴۵۶٬۰۰۰');
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); await flush();
    expect(shopApi.products).toHaveBeenLastCalledWith(expect.objectContaining({ minPrice: 123000, maxPrice: 456000 }));
    const calls = vi.mocked(shopApi.products).mock.calls.length;
    await edit('minPrice', '1e3');
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(container.querySelector('[role=alert]')?.textContent).toContain('قیمت باید');
    expect(shopApi.products).toHaveBeenCalledTimes(calls);
    await click('حذف فیلترها');
    expect(container.querySelector<HTMLInputElement>('[name=minPrice]')!.value).toBe('');
    expect(container.querySelector<HTMLInputElement>('[name=maxPrice]')!.value).toBe('');
    expect(container.querySelector('[role=alert]')).toBeNull();
  });
  it('provides two swipe rails on mobile and an accessible filter drawer, without plus/minus controls', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    await render('/products?brandId=7&q=food&page=3');
    expect(container.querySelectorAll('.catalog-chip-rail')).toHaveLength(2);
    expect(container.querySelector('aside')).toBeNull();
    await click('فیلترها');
    expect(document.querySelector('[role=dialog]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    await click('نوع حیوان');
    const radio = document.querySelector<HTMLInputElement>('input[type=radio][value="1"]')!;
    await act(async () => radio.click()); await flush();
    expect(shopApi.products).toHaveBeenLastCalledWith(expect.objectContaining({ petTypeId: 1, brandId: 7, q: 'food', page: 1 }));
    await click('مشاهدهٔ نتایج'); expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(container.querySelectorAll('.catalog-chip-rail [aria-pressed=true]')).toHaveLength(1);
  });
});
describe('progressive catalog requests', () => {
  it('requests one 24-row batch, appends only near the viewport, deduplicates and stops at the final page', async () => {
    vi.mocked(shopApi.products).mockImplementation(async filters => filters.page === 1 ? page([1, 2], 1, 2) : page([2, 3], 2, 2));
    await render('/products?page=4');
    expect(shopApi.products).toHaveBeenCalledTimes(1);
    expect(shopApi.products).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 24 }));
    expect(container.querySelectorAll('[data-product-id]')).toHaveLength(2);
    await intersect();
    expect(shopApi.products).toHaveBeenCalledTimes(2);
    expect([...container.querySelectorAll('[data-product-id]')].map(node => node.getAttribute('data-product-id'))).toEqual(['1', '2', '3']);
    expect(container.textContent).toContain('همهٔ محصولات نمایش داده شدند');
    expect(button('نمایش محصولات بیشتر')).toBeUndefined();
  });
  it('keeps existing cards on a failed next request, stops automatic retry and permits an explicit retry', async () => {
    let attempts = 0;
    vi.mocked(shopApi.products).mockImplementation(async filters => {
      if (filters.page === 1) return page([1], 1, 2);
      if (++attempts === 1) throw new Error('offline');
      return page([2], 2, 2);
    });
    await render(); await intersect();
    expect(container.querySelectorAll('[data-product-id]')).toHaveLength(1);
    expect(container.textContent).toContain('محصولات قبلی حفظ شده‌اند');
    expect(attempts).toBe(1); await click('تلاش دوباره برای ادامه');
    expect(container.querySelectorAll('[data-product-id]')).toHaveLength(2); expect(attempts).toBe(2);
  });
  it('resets loaded pages on filter change and never mixes late responses from the old filter', async () => {
    let resolveOld!: (value: ReturnType<typeof page>) => void;
    const old = new Promise<ReturnType<typeof page>>(resolve => { resolveOld = resolve; });
    vi.mocked(shopApi.products).mockImplementation(async filters => filters.q === 'cat' ? page([9]) : filters.page === 1 ? page([1], 1, 2) : old);
    await render();
    const observer = [...observers].reverse().find(item => !item.disconnected)!;
    await act(async () => observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await act(async () => container.querySelector('a')!.click()); await flush();
    expect(container.querySelector('[data-product-id="9"]')).not.toBeNull();
    await act(async () => resolveOld(page([2], 2, 2))); await flush();
    expect(container.querySelectorAll('[data-product-id]')).toHaveLength(1);
    expect(container.querySelector('[data-product-id="2"]')).toBeNull();
  });
});
