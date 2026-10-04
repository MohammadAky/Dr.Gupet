// @vitest-environment jsdom
import { act, useState, type FormEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shopApi, type Page } from '../../api/endpoints-shop';
import type { Medicine, Pharmacy, ProductCard } from '../../api/types';
import { Header } from './Header';

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
}

function Harness({ onSubmit }: { onSubmit?: (event: FormEvent<HTMLFormElement>) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  return (
    <><Header
      status="guest"
      userName={null}
      cartCount={0}
      search={search}
      menuOpen={menuOpen}
      onSearchChange={setSearch}
      onSearchSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit?.(event); }}
      onMenuToggle={() => setMenuOpen((open) => !open)}
      onMenuClose={() => setMenuOpen(false)}
      onLogout={() => {}}
    /><CurrentPath /></>
  );
}

const page = <T,>(data: T[], totalPages = 1): Page<T> => ({
  data,
  meta: { page: 1, limit: 50, total: data.length, totalPages },
});

const product = {
  id: 1, name: 'غذای رویال کنین', slug: 'royal-canin', brand: { id: 1, name: 'رویال' },
  image: null, minPrice: 100, inStock: true, lifeStage: 'ALL', sizeClass: 'ALL',
} satisfies ProductCard;

const medicine = {
  id: 2, name: 'داروی رویال', activeIngredient: null, type: null, brand: null, usage: null,
  notes: null, requiresPrescription: false, image: null, isActive: true, petTypes: [],
} satisfies Medicine;

const pharmacy = {
  id: 3, name: 'داروخانه رویال', city: 'تهران', province: 'تهران', address: 'تهران',
  phone: null, is24h: false, isVerified: true,
} satisfies Pharmacy;

const clinic = { ...pharmacy, id: 4, name: 'کلینیک رویال' };

async function changeInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function advanceSearch() {
  await act(async () => {
    vi.advanceTimersByTime(250);
    await Promise.resolve();
  });
}

describe('mobile header controls', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the hamburger menu and opens search separately beside cart', async () => {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <Harness />
        </MemoryRouter>,
      ),
    );
    const menu = container.querySelector<HTMLButtonElement>('.mobile-toggle');
    const search = container.querySelector<HTMLButtonElement>('.mobile-search-trigger');
    const cart = container.querySelector<HTMLAnchorElement>('.cart-link');
    expect(menu).not.toBeNull();
    expect(search).not.toBeNull();
    expect(cart).not.toBeNull();
    expect(search?.parentElement).toBe(cart?.parentElement);
    expect(container.querySelector('.app-nav')?.classList.contains('is-open')).toBe(false);

    await act(async () => menu?.click());
    expect(menu?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.app-nav')?.classList.contains('is-open')).toBe(true);

    await act(async () => search?.click());
    expect(menu?.getAttribute('aria-expanded')).toBe('false');
    expect(search?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.mobile-search')?.hasAttribute('hidden')).toBe(false);
  });

  it('waits for three letters, then groups live API suggestions and navigates to exact detail routes', async () => {
    vi.useFakeTimers();
    const products = vi.spyOn(shopApi, 'products').mockResolvedValue(page([product]));
    const medicines = vi.spyOn(shopApi, 'medicines').mockResolvedValue(page([medicine]));
    const pharmacies = vi.spyOn(shopApi, 'pharmacies').mockResolvedValue(page([pharmacy]));
    const clinics = vi.spyOn(shopApi, 'clinics').mockResolvedValue(page([clinic]));
    await act(async () => root.render(<MemoryRouter><Harness /></MemoryRouter>));
    const input = container.querySelector<HTMLInputElement>('.header-search input')!;

    await changeInput(input, 'رو');
    await advanceSearch();
    expect(products).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-expanded')).toBe('false');

    await changeInput(input, 'روی');
    await advanceSearch();
    expect(products).toHaveBeenCalledWith({ q: 'روی', limit: 5 });
    expect(medicines).toHaveBeenCalledWith({ q: 'روی', limit: 5 });
    expect(pharmacies).toHaveBeenCalledWith({ page: 1, limit: 50 });
    expect(clinics).toHaveBeenCalledWith({ page: 1, limit: 50 });
    expect(Array.from(container.querySelectorAll('.search-suggestions__heading')).map((node) => node.textContent))
      .toEqual(['محصولات', 'داروها', 'داروخانه‌ها', 'کلینیک‌ها']);
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(4);

    const firstOption = container.querySelector<HTMLElement>('#desktop-search-option-0')!;
    firstOption.scrollIntoView = vi.fn();
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(input.getAttribute('aria-activedescendant')).toBe('desktop-search-option-0');
    expect(firstOption.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    await act(async () => {
      input.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(container.querySelector('[data-testid="current-path"]')?.textContent).toBe('/products/royal-canin');
  });

  it('reuses directory pages between keystrokes and ignores older query replies', async () => {
    vi.useFakeTimers();
    let resolveOlder!: (value: Page<ProductCard>) => void;
    const older = new Promise<Page<ProductCard>>((resolve) => { resolveOlder = resolve; });
    const products = vi.spyOn(shopApi, 'products').mockImplementation(({ q }) =>
      q === 'روی' ? older : Promise.resolve(page([{ ...product, id: 5, name: 'غذای رویال دوم', slug: 'royal-two' }])));
    vi.spyOn(shopApi, 'medicines').mockResolvedValue(page([]));
    const pharmacies = vi.spyOn(shopApi, 'pharmacies').mockResolvedValue(page([pharmacy]));
    const clinics = vi.spyOn(shopApi, 'clinics').mockResolvedValue(page([clinic]));
    await act(async () => root.render(<MemoryRouter><Harness /></MemoryRouter>));
    const input = container.querySelector<HTMLInputElement>('.header-search input')!;

    await changeInput(input, 'روی');
    await advanceSearch();
    await changeInput(input, 'رویال');
    await advanceSearch();
    expect(products).toHaveBeenCalledTimes(2);
    expect(pharmacies).toHaveBeenCalledTimes(1);
    expect(clinics).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="option"]')?.textContent).toContain('غذای رویال دوم');

    await act(async () => { resolveOlder(page([product])); await Promise.resolve(); });
    expect(container.querySelector('[role="option"]')?.textContent).toContain('غذای رویال دوم');
    expect(container.querySelector('[role="option"]')?.textContent).not.toContain('غذای رویال کنین');
  });

  it('indicates a truncated directory and lets users select a clinic by touch or click', async () => {
    vi.useFakeTimers();
    vi.spyOn(shopApi, 'products').mockResolvedValue(page([]));
    vi.spyOn(shopApi, 'medicines').mockResolvedValue(page([]));
    const pharmacies = vi.spyOn(shopApi, 'pharmacies').mockImplementation(({ page: pageNumber }) =>
      Promise.resolve(page(pageNumber === 1 ? [pharmacy] : [], 6)));
    vi.spyOn(shopApi, 'clinics').mockResolvedValue(page([clinic]));
    await act(async () => root.render(<MemoryRouter><Harness /></MemoryRouter>));
    const input = container.querySelector<HTMLInputElement>('.header-search input')!;
    await changeInput(input, 'روی');
    await advanceSearch();
    expect(pharmacies.mock.calls.map(([filters]) => filters.page)).toEqual([1, 2, 3, 4, 5]);
    expect(container.textContent).toContain('پیشنهادهای مراکز به فهرست بارگذاری‌شده محدودند.');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(2);
    const clinicOption = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((node) => node.textContent?.includes('کلینیک رویال'))!;
    await act(async () => clinicOption.click());
    expect(container.querySelector('[data-testid="current-path"]')?.textContent).toBe('/clinics/4');
  });

  it('opens mobile suggestions without replacing the hamburger and follows a medicine result', async () => {
    vi.useFakeTimers();
    vi.spyOn(shopApi, 'products').mockResolvedValue(page([]));
    vi.spyOn(shopApi, 'medicines').mockResolvedValue(page([medicine]));
    vi.spyOn(shopApi, 'pharmacies').mockResolvedValue(page([]));
    vi.spyOn(shopApi, 'clinics').mockResolvedValue(page([]));
    await act(async () => root.render(<MemoryRouter><Harness /></MemoryRouter>));
    await act(async () => container.querySelector<HTMLButtonElement>('.mobile-search-trigger')?.click());
    const input = container.querySelector<HTMLInputElement>('.mobile-search input')!;
    expect(container.querySelector('.mobile-toggle')).not.toBeNull();
    await changeInput(input, 'روی');
    await advanceSearch();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#mobile-search-suggestions')).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('#mobile-search-option-0')?.click());
    expect(container.querySelector('[data-testid="current-path"]')?.textContent).toBe('/medicines/2');
    expect(container.querySelector('.mobile-search')?.hasAttribute('hidden')).toBe(true);
  });

  it('shows an honest API error and delegates plain Enter to the existing product search', async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn();
    vi.spyOn(shopApi, 'products').mockRejectedValue(new Error('offline'));
    vi.spyOn(shopApi, 'medicines').mockRejectedValue(new Error('offline'));
    vi.spyOn(shopApi, 'pharmacies').mockRejectedValue(new Error('offline'));
    vi.spyOn(shopApi, 'clinics').mockRejectedValue(new Error('offline'));
    await act(async () => root.render(<MemoryRouter><Harness onSubmit={onSubmit} /></MemoryRouter>));
    const input = container.querySelector<HTMLInputElement>('.header-search input')!;
    await changeInput(input, 'روی');
    await advanceSearch();
    expect(container.textContent).toContain('دریافت نتایج ممکن نشد؛ دوباره تلاش کنید.');
    await act(async () => {
      input.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
