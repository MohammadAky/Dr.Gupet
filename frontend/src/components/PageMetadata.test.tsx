// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { queryKeys } from '../api/query-keys';
import { PageMetadata } from './PageMetadata';

let navigate: ReturnType<typeof useNavigate>;
function Probe() {
  const go = useNavigate();
  useEffect(() => {
    navigate = go;
  }, [go]);
  return <PageMetadata />;
}
let root: Root;
let client: QueryClient;
let container: HTMLDivElement;
const robots = () => document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn());
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Probe />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  document.head
    .querySelectorAll('meta[name="robots"],meta[name="description"]')
    .forEach((meta) => meta.remove());
  document.title = '';
  vi.unstubAllGlobals();
});

it('updates public page metadata without fetching and excludes faceted query URLs', async () => {
  for (const [path, title] of [
    ['/products', 'محصولات'],
    ['/medicines', 'اطلاعات داروها'],
    ['/pharmacies', 'داروخانه‌ها'],
    ['/clinics', 'کلینیک‌ها'],
  ]) {
    await act(async () => navigate(path!));
    expect(document.title).toBe(`${title} | دکتر گوپت`);
    expect(robots()).toBe('index, follow');
  }
  await act(async () => navigate('/products?q=روی'));
  expect(robots()).toBe('noindex, follow');
  expect(fetch).not.toHaveBeenCalled();
});

it('keeps account, checkout, callback and unknown routes out of indexing', async () => {
  for (const path of [
    '/login',
    '/verify',
    '/profile',
    '/pets/1/edit',
    '/addresses/new',
    '/favorites',
    '/cart',
    '/checkout',
    '/orders/2',
    '/payment/result?status=success',
    '/unknown',
    '/clinics/NaN',
  ]) {
    await act(async () => navigate(path));
    expect(robots()).toBe('noindex, follow');
  }
  expect(fetch).not.toHaveBeenCalled();
});

it('observes public detail cache safely and removes the name when leaving that route', async () => {
  await act(async () => navigate('/products/royal'));
  expect(robots()).toBe('noindex, follow');
  const name = '<img src=x onerror=alert(1)> غذای رویال';
  await act(async () => client.setQueryData(queryKeys.product('royal'), { name }));
  expect(document.title).toBe(`${name} | دکتر گوپت`);
  expect(robots()).toBe('index, follow');
  expect(document.head.querySelector('img')).toBeNull();
  await act(async () => navigate('/profile'));
  expect(document.title).toBe('حساب من | دکتر گوپت');
  expect(robots()).toBe('noindex, follow');
  expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  expect(fetch).not.toHaveBeenCalled();
});
