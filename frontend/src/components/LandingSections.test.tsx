// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/endpoints';
import { shopApi } from '../api/endpoints-shop';
import type { Clinic, Medicine, Pharmacy, ProductCard } from '../api/types';
import { landingSample, type LandingContent } from '../features/landing/content';
import { LandingSections } from './LandingSections';

vi.mock('../api/endpoints', () => ({ api: { petTypes: vi.fn() } }));
vi.mock('../api/endpoints-shop', () => ({
  shopApi: {
    clinics: vi.fn(),
    clinic: vi.fn(),
    pharmacies: vi.fn(),
    medicines: vi.fn(),
    products: vi.fn(),
    nearbyClinics: vi.fn(),
    nearbyPharmacies: vi.fn(),
  },
}));

const clinic = (id: number): Clinic => ({
  id,
  name: `کلینیک ثبت‌شدهٔ ${id}`,
  province: 'تهران',
  city: 'تهران',
  address: 'نشانی ثبت‌شده',
  phone: null,
  is24h: false,
  isVerified: false,
});
const pharmacy: Pharmacy = {
  ...clinic(11),
  name: 'داروخانهٔ نمایشی — نمونه نمایشی',
  isSample: true,
  lat: null,
  lng: null,
  image: '/brand/discovery-pharmacy-480.webp',
};
const product: ProductCard = {
  id: 71,
  name: 'غذای نمایشی',
  slug: 'presentation-v1-dog-food',
  isSample: true,
  brand: { id: 1, name: 'برند نمایشی' },
  image: '/brand/landing-meal-mobile.webp',
  minPrice: 180000,
  inStock: false,
  lifeStage: 'ALL',
  sizeClass: 'ALL',
};
const medicine: Medicine = {
  id: 81,
  name: 'اطلاعات دارویی — نمونه نمایشی',
  isSample: true,
  activeIngredient: null,
  type: null,
  brand: null,
  usage: null,
  notes: null,
  requiresPrescription: false,
  image: '/brand/discovery-medicine-480.webp',
  isActive: true,
  petTypes: [],
};

describe('persisted landing records and shared consent-based nearby centers', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  let locate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.resetAllMocks();
    locate = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: locate } });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(api.petTypes).mockResolvedValue([
      { id: 4, name: 'گربه', slug: 'cat' },
      { id: 3, name: 'سگ', slug: 'سگ' },
      { id: 5, name: 'پرنده', slug: 'birds' },
      { id: 8, name: 'خرگوش', slug: 'rabbit' },
    ]);
    vi.mocked(shopApi.clinics).mockResolvedValue({
      data: [clinic(1), clinic(2), clinic(3)],
      meta: { page: 1, limit: 4, total: 40, totalPages: 10 },
    });
    vi.mocked(shopApi.pharmacies).mockResolvedValue({ data: [pharmacy] });
    vi.mocked(shopApi.products).mockResolvedValue({ data: [product] });
    vi.mocked(shopApi.medicines).mockResolvedValue({ data: [medicine] });
    vi.mocked(shopApi.nearbyClinics).mockResolvedValue({
      data: [{ ...clinic(99), distanceKm: 0.7 }],
    });
    vi.mocked(shopApi.nearbyPharmacies).mockResolvedValue({ data: [] });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
  });
  async function show(content: LandingContent = landingSample) {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <LandingSections content={content} />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
    await vi.waitFor(() =>
      expect(container.querySelectorAll('.landing-species__item')).toHaveLength(4),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await vi.waitFor(() =>
      expect(container.querySelector('.landing-medicines h3 a')?.getAttribute('href')).toBe(
        '/medicines/81',
      ),
    );
  }
  function locationButton() {
    return container.querySelector<HTMLButtonElement>('.landing-location button')!;
  }
  async function grant() {
    await act(async () => locationButton().click());
    const success = locate.mock.calls.at(-1)![0] as PositionCallback;
    await act(async () => {
      success({ coords: { latitude: 35.7, longitude: 51.4 } } as GeolocationPosition);
    });
    await vi.waitFor(() => expect(shopApi.nearbyClinics).toHaveBeenCalled());
  }

  it('uses persisted records and their real detail identifiers without public sample clutter', async () => {
    await show();
    expect(shopApi.products).toHaveBeenCalledWith({ page: 1, limit: 8, sampleOnly: true });
    expect(shopApi.medicines).toHaveBeenCalledWith({ page: 1, limit: 8, sampleOnly: true });
    expect(
      container.querySelector('.landing-bestsellers .product-card__link')?.getAttribute('href'),
    ).toBe('/products/presentation-v1-dog-food');
    expect(container.querySelector('.landing-medicines h3 a')?.getAttribute('href')).toBe(
      '/medicines/81',
    );
    expect(container.querySelector('.landing-pharmacies h3 a')?.getAttribute('href')).toBe(
      '/pharmacies/11',
    );
    expect(container.querySelector('.landing-bestsellers')?.textContent).toContain('ناموجود');
    expect(container.querySelector('.landing-demo-notice')).toBeNull();
    expect(container.textContent).not.toContain('داروی واقعی نیست');
    expect(container.textContent).not.toContain('مرکز واقعی نیست');
    expect(container.textContent).not.toContain('— نمونه نمایشی');
    expect(container.textContent).not.toContain('کلینیک نمونهٔ سپید');
  });

  it('keeps exact section order and care centers in fixed grids while only products and medicines are carousels', async () => {
    await show();
    expect([...container.querySelectorAll('h2')].map((item) => item.textContent)).toEqual([
      'برای همراه شما',
      'پرفروش‌ترین محصولات',
      'کلینیک‌های نزدیک من',
      'داروخانه‌ها',
      'داروها',
    ]);
    expect(container.querySelectorAll('.landing-clinics .landing-centers--fixed')).toHaveLength(1);
    expect(container.querySelectorAll('.landing-pharmacies .landing-centers--fixed')).toHaveLength(
      1,
    );
    expect(container.querySelector('.landing-clinics .landing-carousel')).toBeNull();
    expect(container.querySelector('.landing-pharmacies .landing-carousel')).toBeNull();
    expect(container.querySelectorAll('.landing-carousel')).toHaveLength(2);
    expect(shopApi.clinics).toHaveBeenCalledWith({ page: 1, limit: 4 });
    expect(shopApi.pharmacies).toHaveBeenCalledWith({ page: 1, limit: 4 });
  });

  it('has one shared location action and never requests or sends coordinates on page load', async () => {
    await show();
    expect(container.querySelectorAll('.landing-location button')).toHaveLength(1);
    expect(locate).not.toHaveBeenCalled();
    expect(shopApi.nearbyClinics).not.toHaveBeenCalled();
    expect(shopApi.nearbyPharmacies).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      'موقعیت شما برای محاسبهٔ فاصله به سرور ما ارسال می‌شود',
    );
  });

  it('requests global backend nearby results for both kinds after permission and uses a center outside the initial page', async () => {
    await show();
    await grant();
    expect(shopApi.nearbyClinics).toHaveBeenCalledWith({ lat: 35.7, lng: 51.4, page: 1, limit: 4 });
    expect(shopApi.nearbyPharmacies).toHaveBeenCalledWith({
      lat: 35.7,
      lng: 51.4,
      page: 1,
      limit: 4,
    });
    expect(shopApi.clinic).not.toHaveBeenCalled();
    expect(container.querySelector('.landing-clinics h3 a')?.getAttribute('href')).toBe(
      '/clinics/99',
    );
    expect(container.querySelector('.landing-clinics')?.textContent).toContain(
      'فاصلهٔ مستقیم تقریبی',
    );
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ),
    ).not.toContain('35.7');
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ),
    ).not.toContain('51.4');
  });

  it('retains registered grids and offers retry when location permission is denied', async () => {
    await show();
    await act(async () => locationButton().click());
    const fail = locate.mock.calls[0]![1] as PositionErrorCallback;
    await act(async () => fail({ code: 1 } as GeolocationPositionError));
    expect(container.querySelector('#landing-location-status')?.getAttribute('role')).toBe('alert');
    expect(container.textContent).toContain('دسترسی به موقعیت داده نشد');
    expect(container.querySelectorAll('.landing-clinics h3')).toHaveLength(3);
    expect(locationButton().disabled).toBe(false);
    expect(shopApi.nearbyClinics).not.toHaveBeenCalled();
  });

  it('keeps a meaningful pharmacy default grid without distance when no real geocoded pharmacy exists', async () => {
    await show();
    await grant();
    expect(container.querySelector('.landing-pharmacies h3 a')?.getAttribute('href')).toBe(
      '/pharmacies/11',
    );
    expect(container.querySelector('.landing-pharmacies .landing-center__distance')).toBeNull();
    expect(container.querySelector('.landing-pharmacies')?.textContent).toContain(
      'موقعیت معتبری برای داروخانه‌های این فهرست ثبت نشده است.',
    );
  });

  it('isolates endpoint failures so successful clinic distances remain while pharmacies keep their default grid', async () => {
    vi.mocked(shopApi.nearbyPharmacies).mockRejectedValue(new Error('offline'));
    await show();
    await grant();
    expect(container.querySelector('.landing-clinics h3')?.textContent).toContain('99');
    expect(container.querySelector('.landing-clinics .landing-center__distance')).not.toBeNull();
    expect(container.querySelector('.landing-pharmacies [role="alert"]')).not.toBeNull();
    expect(container.querySelector('.landing-pharmacies h3')?.textContent).toBe('داروخانهٔ نمایشی');
  });

  it('rejects sample or invalid-distance nearby rows instead of falsely showing their distance', async () => {
    vi.mocked(shopApi.nearbyPharmacies).mockResolvedValue({
      data: [
        { ...pharmacy, distanceKm: 0.1 },
        { ...clinic(22), distanceKm: NaN },
      ],
    });
    await show();
    await grant();
    expect(container.querySelector('.landing-pharmacies .landing-center__distance')).toBeNull();
    expect(container.querySelector('.landing-pharmacies h3')?.textContent).toBe('داروخانهٔ نمایشی');
  });

  it('keeps genuine paid rankings unavailable instead of passing ordinary newest products off as bestsellers', async () => {
    await show({
      ...landingSample,
      sections: {
        ...landingSample.sections,
        products: { ...landingSample.sections.products, demo: false },
      },
    });
    expect(shopApi.products).not.toHaveBeenCalled();
    expect(container.querySelector('.landing-bestsellers')?.textContent).toContain(
      'پس از آماده‌شدن آمار فروش',
    );
  });

  it('releases pending state when browser location access throws synchronously', async () => {
    locate.mockImplementation(() => {
      throw new Error('blocked');
    });
    await show();
    await act(async () => locationButton().click());
    expect(locationButton().disabled).toBe(false);
    expect(container.querySelector('#landing-location-status')?.getAttribute('role')).toBe('alert');
    expect(shopApi.nearbyClinics).not.toHaveBeenCalled();
  });
});
