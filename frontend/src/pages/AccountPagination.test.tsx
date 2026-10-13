// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { shopApi } from '../api/endpoints-shop';
import type { OrderSummary, Pet, RecommendationItem } from '../api/types';
import { OrdersPage } from './OrdersPage';
import { RecommendationsPage } from './RecommendationsPage';

vi.mock('../auth/auth-provider', () => ({ useAuth: () => ({ status: 'authed', user: { id: 1 } }) }));
vi.mock('../api/endpoints', () => ({ api: { listPets: vi.fn() } }));
vi.mock('../api/endpoints-shop', () => ({ shopApi: { orders: vi.fn(), recommendations: vi.fn() } }));
const order: OrderSummary = { id: 7, orderNumber: 'ORDER-7', status: 'PAID', createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '', items: [], payments: [], itemsTotal: 100000, discountAmount: 0, shippingCost: 0, finalAmount: 100000 };
const pet: Pet = { id: 5, name: 'باران', userId: 1, petTypeId: 1, breedId: null, birthDate: null, gender: null,
  isNeutered: false, weightKg: null, photo: null, deletedAt: null, createdAt: '', updatedAt: '',
  petType: { id: 1, name: 'گربه', slug: 'cat' }, breed: null, tags: [], lifeStage: 'ADULT' };
const card: RecommendationItem = { id: 8, name: 'غذای گربه', slug: 'cat-food', brand: { id: 1, name: 'برند' },
  image: null, minPrice: 100000, inStock: true, lifeStage: 'ALL', sizeClass: 'ALL', matchedTags: [], matchScore: 0 };
const meta = (page: number) => ({ page, limit: 20, total: 1, totalPages: 1 });
let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
function Location() { return <output>{useLocation().search}</output>; }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  vi.mocked(api.listPets).mockResolvedValue([pet]);
});
afterEach(async () => {
  await act(async () => root.unmount()); client.clear(); container.remove(); vi.unstubAllGlobals();
});
async function mount(url: string, recommendations: boolean) {
  await act(async () => root.render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}>
    {recommendations ? <RecommendationsPage /> : <OrdersPage />}<Location />
  </MemoryRouter></QueryClientProvider>));
  await vi.waitFor(() => expect(container.textContent).toContain('بازگشت به صفحهٔ اول'));
}
async function returnToFirst() {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find((node) => node.textContent === 'بازگشت به صفحهٔ اول')!;
  await act(async () => button.click());
}
it('recovers an empty order page without claiming the user never ordered or discarding query context', async () => {
  vi.mocked(shopApi.orders).mockImplementation(async (page = 1) => ({ data: page === 1 ? [order] : [], meta: meta(page) }));
  await mount('/orders?page=99&view=recent', false);
  expect(container.textContent).not.toContain('هنوز سفارشی ثبت نکرده‌اید.');
  await returnToFirst();
  await vi.waitFor(() => expect(container.textContent).toContain('ORDER-7'));
  expect(container.querySelector('output')?.textContent).toBe('?view=recent');
  expect(shopApi.orders).toHaveBeenLastCalledWith(1);
});
it('recovers an empty recommendation page while retaining the chosen pet', async () => {
  vi.mocked(shopApi.recommendations).mockImplementation(async (_petId, page = 1) => ({ data: page === 1 ? [card] : [], meta: meta(page) }));
  await mount('/recommendations?petId=5&page=99', true);
  expect(container.textContent).not.toContain('پروفایل او را کامل‌تر کنید.');
  await returnToFirst();
  await vi.waitFor(() => expect(container.textContent).toContain('غذای گربه'));
  expect(container.querySelector('output')?.textContent).toBe('?petId=5');
  expect(shopApi.recommendations).toHaveBeenLastCalledWith(5, 1);
});
