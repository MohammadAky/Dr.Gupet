// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shopApi } from '../api/endpoints-shop';
import type { ClinicDetail } from '../api/types';
import { ClinicDetailPage } from '../pages/ClinicDetailPage';
import { DirectoryPage } from './DirectoryPage';

vi.mock('../api/endpoints-shop', () => ({
  shopApi: { clinics: vi.fn(), pharmacies: vi.fn(), clinic: vi.fn() },
}));

const clinic: ClinicDetail = {
  id: 12,
  name: 'کلینیک آزمایشی',
  province: 'خراسان رضوی',
  city: 'مشهد',
  address: 'نشانی ثبت‌شدهٔ مرکز',
  phone: '05112345678',
  is24h: true,
  isVerified: false,
  lat: 36.3,
  lng: 59.5,
  workingHours: null,
};

describe('clinic directory presentation preserves real information', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.resetAllMocks();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(shopApi.clinics).mockResolvedValue({
      data: [clinic],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    vi.mocked(shopApi.pharmacies).mockResolvedValue({ data: [clinic] });
    vi.mocked(shopApi.clinic).mockResolvedValue(clinic);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
  });

  async function show(path: string, kind: 'clinics' | 'pharmacies' = 'clinics') {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={`/${kind}`} element={<DirectoryPage kind={kind} />} />
              <Route path="/clinics/:id" element={<ClinicDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
  }

  it('labels generic imagery and retains truthful status, address and contact links', async () => {
    await show('/clinics');
    await vi.waitFor(() => expect(container.querySelector('.clinic-card')).not.toBeNull());
    expect(container.querySelector('figcaption')?.textContent).toBe('تصویر نمادین');
    expect(container.querySelector('img')?.src).toContain('/brand/');
    expect(container.textContent).toContain(clinic.address);
    expect(container.textContent).toContain('۲۴ ساعته');
    expect(container.textContent).not.toContain('تأییدشده');
    expect(container.querySelector('h2 a')?.getAttribute('href')).toBe('/clinics/12');
    expect(container.querySelector('a[href^="tel:"]')?.getAttribute('href')).toBe(
      `tel:${clinic.phone}`,
    );
  });

  it('preserves province, city, 24 hour and pagination API filters', async () => {
    await show('/clinics?province=خراسان%20رضوی&city=مشهد&is24h=1&page=2');
    await vi.waitFor(() => expect(shopApi.clinics).toHaveBeenCalled());
    expect(shopApi.clinics).toHaveBeenLastCalledWith({
      province: 'خراسان رضوی',
      city: 'مشهد',
      is24h: true,
      page: 2,
    });
    expect(shopApi.pharmacies).not.toHaveBeenCalled();
    await act(async () => {
      const button = Array.from(container.querySelectorAll('button')).find(
        (item) => item.textContent === 'پاک‌کردن فیلترها',
      );
      button?.click();
    });
    await vi.waitFor(() =>
      expect(shopApi.clinics).toHaveBeenLastCalledWith({
        province: undefined,
        city: undefined,
        is24h: undefined,
        page: 1,
      }),
    );
  });

  it('preserves pharmacies and does not mislabel their venue with clinic artwork', async () => {
    await show('/pharmacies?onDuty=true', 'pharmacies');
    await vi.waitFor(() => expect(container.querySelector('.directory-card')).not.toBeNull());
    expect(shopApi.pharmacies).toHaveBeenCalledWith({
      province: undefined,
      city: undefined,
      is24h: undefined,
      page: 1,
      onDuty: true,
    });
    expect(container.querySelector('.clinic-card')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('keeps sample records browseable without sample suffixes, placeholder locations or fake status', async () => {
    vi.mocked(shopApi.pharmacies).mockResolvedValue({ data: [{
      ...clinic,
      name: 'داروخانه سپید — نمونه نمایشی',
      isSample: true,
      city: 'نمونه نمایشی',
      province: 'نمونه نمایشی',
      address: 'نشانی ساختگی',
      isVerified: true,
      image: '/brand/discovery-pharmacy-480.webp',
    }] });
    await show('/pharmacies', 'pharmacies');
    await vi.waitFor(() => expect(container.querySelector('h2 a')?.textContent).toBe('داروخانه سپید'));
    expect(container.querySelector('h2 a')?.getAttribute('href')).toBe(`/pharmacies/${clinic.id}`);
    expect(container.textContent).not.toContain('نمونه نمایشی');
    expect(container.textContent).not.toContain('نشانی ساختگی');
    expect(container.textContent).not.toContain('تأییدشده');
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('shows unknown hours honestly while keeping telephone and non-embedded map navigation', async () => {
    await show('/clinics/12');
    await vi.waitFor(() => expect(container.querySelector('h1')?.textContent).toBe(clinic.name));
    expect(shopApi.clinic).toHaveBeenCalledWith(12);
    expect(container.textContent).toContain('ساعات کاری ثبت نشده است.');
    expect(container.textContent).toContain('عکس این مرکز نیست');
    const map = container.querySelector('a[href^="https://www.openstreetmap.org"]');
    expect(map?.getAttribute('href')).toContain('mlat=36.3&mlon=59.5');
    expect(map?.getAttribute('rel')).toBe('noreferrer');
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('keeps an illustration consistent between list and detail without repeating adjacent scenes', async () => {
    vi.mocked(shopApi.clinics).mockResolvedValue({
      data: [clinic, { ...clinic, id: 13 }, { ...clinic, id: 14 }],
    });
    await show('/clinics');
    await vi.waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(3));
    const images = Array.from(container.querySelectorAll('img')).map((image) =>
      image.getAttribute('src'),
    );
    expect(new Set(images).size).toBe(3);
    const detailLink = container.querySelector('h2 a') as HTMLAnchorElement;
    await act(async () => detailLink.click());
    await vi.waitFor(() => expect(container.querySelector('.clinic-detail img')).not.toBeNull());
    expect(container.querySelector('.clinic-detail img')?.getAttribute('src')).toBe(
      images[0]?.replace('-480.webp', '-960.webp'),
    );
  });

  it('does not fetch an invalid clinic identity', async () => {
    await show('/clinics/NaN');
    expect(container.textContent).toContain('شناسهٔ کلینیک معتبر نیست.');
    expect(shopApi.clinic).not.toHaveBeenCalled();
  });

  it('submits typed directory filters without remounting or losing the focused input', async () => {
    await show('/clinics');
    await vi.waitFor(() => expect(shopApi.clinics).toHaveBeenCalled());
    const city = container.querySelectorAll<HTMLInputElement>('input[role="combobox"]')[1]!;
    await act(async () => city.focus());
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        city,
        'مشهد جدید',
      );
      city.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.activeElement).toBe(city);
    expect(shopApi.clinics).toHaveBeenLastCalledWith({
      province: undefined,
      city: undefined,
      is24h: undefined,
      page: 1,
    });
    await act(async () =>
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
    await vi.waitFor(() =>
      expect(shopApi.clinics).toHaveBeenLastCalledWith({
        province: undefined,
        city: 'مشهد جدید',
        is24h: undefined,
        page: 1,
      }),
    );
    expect(container.querySelectorAll('input[role="combobox"]')[1]).toBe(city);
    expect(document.activeElement).toBe(city);
    expect(city.value).toBe('مشهد جدید');
  });
});
