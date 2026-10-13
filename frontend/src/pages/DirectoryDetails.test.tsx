// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { shopApi } from '../api/endpoints-shop';
import { MedicineDetailPage } from './MedicineDetailPage';
import { PharmacyDetailPage } from './PharmacyDetailPage';
import { ClinicDetailPage } from './ClinicDetailPage';

vi.mock('../api/endpoints-shop', () => ({
  shopApi: { medicine: vi.fn(), pharmacy: vi.fn(), clinic: vi.fn() },
}));

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
});

const cases = [
  {
    kind: 'medicines',
    method: 'medicine',
    heading: 'اطلاعات دارو',
    page: <MedicineDetailPage />,
    result: {
      id: 1,
      name: 'داروی ثبت‌شده',
      activeIngredient: null,
      type: null,
      brand: null,
      usage: null,
      notes: null,
      requiresPrescription: true,
      image: null,
      isActive: true,
      petTypes: [],
      disclaimer: 'مصرف با نظر دامپزشک',
      pharmacies: [],
    },
  },
  {
    kind: 'pharmacies',
    method: 'pharmacy',
    heading: 'اطلاعات داروخانه',
    page: <PharmacyDetailPage />,
    result: {
      id: 1,
      name: 'مرکز ثبت‌شده',
      province: 'تهران',
      city: 'تهران',
      address: 'نشانی مرکز',
      phone: null,
      is24h: false,
      isVerified: false,
      lat: null,
      lng: null,
      workingHours: null,
    },
  },
  {
    kind: 'clinics',
    method: 'clinic',
    heading: 'اطلاعات کلینیک',
    page: <ClinicDetailPage />,
    result: {
      id: 1,
      name: 'مرکز ثبت‌شده',
      province: 'تهران',
      city: 'تهران',
      address: 'نشانی مرکز',
      phone: null,
      is24h: false,
      isVerified: false,
      lat: null,
      lng: null,
      workingHours: null,
    },
  },
] as const;

async function show(test: (typeof cases)[number], id: string) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/${test.kind}/${id}`]}>
          <Routes>
            <Route path={`/${test.kind}/:id`} element={test.page} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}

it.each(cases)(
  'retains $kind heading and backlink during loading and failed retry',
  async (test) => {
    let reject!: (error: Error) => void;
    const load = vi.mocked(shopApi[test.method]);
    load.mockReturnValueOnce(
      new Promise<never>((_, fail) => {
        reject = fail;
      }),
    );
    await show(test, '1');
    expect(container.querySelector('h1')?.textContent).toBe(test.heading);
    expect(container.querySelector('a')?.getAttribute('href')).toBe(`/${test.kind}`);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    await act(async () => reject(new Error('دریافت اطلاعات ناموفق بود')));
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    expect(container.querySelector('h1')?.textContent).toBe(test.heading);
    expect(container.querySelector('a')?.getAttribute('href')).toBe(`/${test.kind}`);
    // A real retry goes through the same API instead of trapping the reader in an error.
    if (test.method === 'medicine') {
      vi.mocked(shopApi.medicine).mockResolvedValueOnce({
        ...test.result,
        petTypes: [],
        pharmacies: [],
      });
    } else if (test.method === 'pharmacy') {
      vi.mocked(shopApi.pharmacy).mockResolvedValueOnce(test.result);
    } else {
      vi.mocked(shopApi.clinic).mockResolvedValueOnce(test.result);
    }
    await act(async () => container.querySelector('button')!.click());
    await vi.waitFor(() =>
      expect(container.querySelector('h1')?.textContent).toBe(test.result.name),
    );
    expect(load).toHaveBeenCalledTimes(2);
  },
);

it('keeps sample medicine artwork and a clean heading without suggesting prescription availability', async () => {
  vi.mocked(shopApi.medicine).mockResolvedValue({
    ...cases[0].result,
    name: 'اطلاعات دارویی — نمونه نمایشی',
    isSample: true,
    requiresPrescription: false,
    image: '/brand/discovery-medicine-480.webp',
    petTypes: [],
    pharmacies: [],
  });
  await show(cases[0], '1');
  await vi.waitFor(() => expect(container.querySelector('h1')?.textContent).toBe('اطلاعات دارویی'));
  expect(container.querySelector('.sample-record-note')).toBeNull();
  expect(container.textContent).not.toContain('نمونه نمایشی');
  expect(container.textContent).toContain('پیش از مصرف هر دارو با دامپزشک مشورت کنید.');
  expect(container.textContent).not.toContain('بدون نسخه');
  expect(container.querySelector('img')?.getAttribute('src')).toContain(
    '/brand/discovery-medicine-480.webp',
  );
});

it('cleans sample pharmacy headings while suppressing fake location/contact/map actions', async () => {
  vi.mocked(shopApi.pharmacy).mockResolvedValue({
    ...cases[1].result,
    name: 'داروخانهٔ نمایشی — نمونه نمایشی',
    isSample: true,
    phone: '02112345678',
    lat: 35.7,
    lng: 51.4,
    image: '/brand/discovery-pharmacy-480.webp',
    city: 'نمونه نمایشی',
    province: 'نمونه نمایشی',
    address: 'نشانی ساختگی نباید نمایش داده شود',
  });
  await show(cases[1], '1');
  await vi.waitFor(() => expect(container.querySelector('h1')?.textContent).toBe('داروخانهٔ نمایشی'));
  expect(container.querySelector('.sample-record-note')).toBeNull();
  expect(container.textContent).not.toContain('نمونه نمایشی');
  expect(container.textContent).not.toContain('نشانی ساختگی');
  expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  expect(container.querySelector('a[href*="openstreetmap"]')).toBeNull();
  expect(container.querySelector('img')?.getAttribute('src')).toContain(
    '/brand/discovery-pharmacy-480.webp',
  );
});

it.each(cases)(
  'keeps a useful $kind escape route for an invalid URL without sending a request',
  async (test) => {
    await show(test, 'not-a-number');
    expect(container.querySelector('h1')?.textContent).toBe(test.heading);
    expect(container.querySelector('a')?.getAttribute('href')).toBe(`/${test.kind}`);
    expect(container.querySelector('.state-empty')).not.toBeNull();
    expect(shopApi[test.method]).not.toHaveBeenCalled();
  },
);
