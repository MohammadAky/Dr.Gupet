// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shopApi } from '../api/endpoints-shop';
import { queryKeys } from '../api/query-keys';
import type { CartView, ProductDetail } from '../api/types';
import { useAuth } from '../auth/auth-provider';
import { ProductDetailPage } from './ProductDetailPage';
import { signalCartAdded } from '../features/cart/cart-feedback';
import { GUEST_CART_KEY, readGuestCart } from '../features/cart/guest-cart';

vi.mock('../api/endpoints-shop', () => ({
  shopApi: {
    product: vi.fn(),
    products: vi.fn(),
    favorites: vi.fn(),
    addCartItem: vi.fn(),
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  },
}));
vi.mock('../auth/auth-provider', () => ({ useAuth: vi.fn() }));
vi.mock('../features/cart/cart-feedback', () => ({ signalCartAdded: vi.fn() }));

const detail: ProductDetail = {
  id: 1,
  name: 'غذای سگ',
  slug: 'dog-food',
  description: null,
  ingredientsText: null,
  lifeStage: 'ADULT',
  sizeClass: 'ALL',
  neuterSuitability: 'ANY',
  isActive: true,
  createdAt: '',
  updatedAt: '',
  brand: { id: 2, name: 'برند', slug: 'brand' },
  category: { id: 3, name: 'غذا', slug: 'food' },
  petType: { id: 4, name: 'سگ', slug: 'dog' },
  images: [],
  tags: [],
  variants: [
    {
      id: 11,
      sku: 'dog-1',
      weightGram: 1000,
      price: 100_000,
      compareAtPrice: null,
      inStock: true,
      lowStock: false,
    },
    {
      id: 12,
      sku: 'dog-2',
      weightGram: 2000,
      price: 200_000,
      compareAtPrice: null,
      inStock: false,
      lowStock: false,
    },
  ],
};
const cartView: CartView = { items: [], itemsTotal: 0 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function changeInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('product detail private actions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  let mounted: boolean;

  function renderPage() {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/products/dog-food']}>
          <Routes>
            <Route path="/products/:slug" element={<ProductDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  function submitForm() {
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  beforeEach(() => {
    localStorage.clear();
    readGuestCart();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.resetAllMocks();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    mounted = true;
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(useAuth).mockReturnValue({ status: 'authed', user: { id: 7 } } as ReturnType<
      typeof useAuth
    >);
    vi.mocked(shopApi.product).mockResolvedValue(detail);
    vi.mocked(shopApi.products).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 24, total: 0, totalPages: 0 },
    });
    vi.mocked(shopApi.favorites).mockResolvedValue({ data: [] });
    vi.mocked(shopApi.addCartItem).mockResolvedValue(cartView);
    vi.mocked(shopApi.addFavorite).mockResolvedValue(undefined);
    vi.mocked(shopApi.removeFavorite).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
  });

  async function showPage() {
    await act(async () => renderPage());
    await vi.waitFor(() => expect(container.querySelector('#qty')).not.toBeNull());
  }

  it('saves a guest basket durably without making private cart or favorite requests', async () => {
    vi.mocked(useAuth).mockReturnValue({ status: 'guest', user: null } as ReturnType<
      typeof useAuth
    >);
    await showPage();
    expect(shopApi.favorites).not.toHaveBeenCalled();
    expect(container.textContent).toContain('مشاهدهٔ سبد خرید مهمان');
    await act(async () => submitForm());
    expect(readGuestCart()).toEqual([
      expect.objectContaining({ variantId: 11, quantity: 1, productName: detail.name }),
    ]);
    expect(signalCartAdded).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
    expect(shopApi.addCartItem).not.toHaveBeenCalled();
    expect(shopApi.addFavorite).not.toHaveBeenCalled();
  });
  it('blocks an authenticated addition if another tab persisted a guest handoff before its storage event renders', async () => {
    await showPage();
    localStorage.setItem(
      GUEST_CART_KEY,
      JSON.stringify({
        version: 1,
        transfer: null,
        items: [
          {
            variantId: 11,
            quantity: 2,
            productId: 1,
            productName: detail.name,
            productSlug: detail.slug,
            productImage: null,
            weightGram: 1000,
            unitPrice: 100_000,
          },
        ],
      }),
    );
    await act(async () => submitForm());
    expect(shopApi.addCartItem).not.toHaveBeenCalled();
    expect(readGuestCart()[0]?.quantity).toBe(2);
  });

  it.each([
    { ...detail, isSample: true },
    { ...detail, slug: 'presentation-v1-dog-food' },
  ])(
    'blocks persisted presentation products even when an old response marks the variant in stock',
    async (sample) => {
      vi.mocked(shopApi.product).mockResolvedValue(sample);
      await showPage();
      expect(container.querySelector('.sample-record-note')).toBeNull();
      expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent).toBe(
        'ناموجود',
      );
      expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
        true,
      );
      await act(async () => submitForm());
      expect(shopApi.addCartItem).not.toHaveBeenCalled();
    },
  );

  it('rejects fractional/out-of-range quantities and sends one integer request per submit', async () => {
    const pending = deferred<CartView>();
    vi.mocked(shopApi.addCartItem).mockReturnValue(pending.promise);
    await showPage();
    const qty = container.querySelector<HTMLInputElement>('#qty')!;
    expect(qty.type).toBe('text');
    expect(qty.inputMode).toBe('numeric');
    await changeInput(qty, '1.5');
    expect(qty.value).toBe('1.5');
    expect(qty.getAttribute('aria-invalid')).toBe('true');
    await act(async () => submitForm());
    expect(shopApi.addCartItem).not.toHaveBeenCalled();
    await changeInput(qty, '21');
    await act(async () => submitForm());
    expect(shopApi.addCartItem).not.toHaveBeenCalled();
    await changeInput(qty, '2');
    await act(async () => {
      submitForm();
      submitForm();
    });
    expect(shopApi.addCartItem).toHaveBeenCalledTimes(1);
    expect(shopApi.addCartItem).toHaveBeenCalledWith(11, 2);
    expect(signalCartAdded).not.toHaveBeenCalled();
    await act(async () => pending.resolve(cartView));
    expect(container.textContent).toContain('به سبد خرید اضافه شد.');
    expect(signalCartAdded).toHaveBeenCalledTimes(1);
    expect(signalCartAdded).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, keyboard: true }),
    );
  });

  it('accepts typed Persian and Arabic quantities through the existing API maximum of twenty', async () => {
    await showPage();
    const qty = container.querySelector<HTMLInputElement>('#qty')!;
    await changeInput(qty, '۲۰');
    await act(async () => submitForm());
    expect(shopApi.addCartItem).toHaveBeenLastCalledWith(11, 20);
    await changeInput(qty, '١١');
    await act(async () => submitForm());
    expect(shopApi.addCartItem).toHaveBeenLastCalledWith(11, 11);
    await changeInput(qty, '۲۱');
    await act(async () => submitForm());
    expect(shopApi.addCartItem).toHaveBeenCalledTimes(2);
  });

  it('does not submit an unavailable selected variant', async () => {
    await showPage();
    await act(async () => {
      const unavailable = container.querySelector<HTMLInputElement>('input[value="12"]')!;
      unavailable.click();
    });
    await act(async () => submitForm());
    expect(shopApi.addCartItem).not.toHaveBeenCalled();
  });

  it('updates the purchase panel from the selected real variant and hides stale prices for unavailable stock', async () => {
    await showPage();
    const panel = container.querySelector<HTMLElement>('.product-detail__purchase')!;
    expect(panel.getAttribute('aria-labelledby')).toBe('product-purchase-heading');
    expect(panel.querySelector('.commerce-product-price')?.textContent).toContain('۱۰۰٬۰۰۰');
    await act(async () => container.querySelector<HTMLInputElement>('input[value="12"]')!.click());
    expect(panel.querySelector('.product-detail__availability')?.textContent).toBe('ناموجود');
    expect(panel.querySelector('.commerce-product-price')).toBeNull();
    expect(panel.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(panel.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent).toBe(
      'ناموجود',
    );
    await act(async () => submitForm());
    expect(shopApi.addCartItem).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLInputElement>('input[value="11"]')!.click());
    expect(panel.querySelector('.commerce-product-price')?.textContent).toContain('۱۰۰٬۰۰۰');
    await act(async () => submitForm());
    expect(shopApi.addCartItem).toHaveBeenCalledWith(11, 1);
  });

  it('presents only API-provided description, ingredients and specifications with working section destinations', async () => {
    vi.mocked(shopApi.product).mockResolvedValue({
      ...detail,
      description: 'توضیح واقعی محصول\nخط دوم',
      ingredientsText: 'ترکیبات ثبت‌شده',
      tags: [{ id: 8, name: 'بدون غلات', slug: 'grain-free', type: 'DIET' }],
    });
    await showPage();
    expect(container.querySelector('#product-description')?.textContent).toContain(
      'توضیح واقعی محصول\nخط دوم',
    );
    expect(container.querySelector('#product-ingredients')?.textContent).toContain(
      'ترکیبات ثبت‌شده',
    );
    const specifications = container.querySelector('#product-specifications')!;
    expect(specifications.textContent).toContain('بالغ');
    expect(specifications.textContent).toContain('بدون غلات');
    expect(specifications.textContent).toContain('سگ');
    expect(specifications.textContent).toContain('برند');
    for (const anchor of container.querySelectorAll<HTMLAnchorElement>(
      '.product-detail__section-links a',
    ))
      expect(container.querySelector(anchor.hash)).not.toBeNull();
    expect(container.querySelector('.product-detail__facts')?.textContent).toContain('همه سایزها');
  });

  it('omits empty descriptive sections instead of filling them with invented product content', async () => {
    await showPage();
    expect(container.querySelector('#product-description')).toBeNull();
    expect(container.querySelector('#product-ingredients')).toBeNull();
    expect(container.querySelectorAll('.product-detail__section-links a')).toHaveLength(1);
    expect(container.querySelector('#product-specifications')).not.toBeNull();
  });

  it('ignores an old cart response after account switch and permits the new account request', async () => {
    const oldRequest = deferred<CartView>();
    const newRequest = deferred<CartView>();
    vi.mocked(shopApi.addCartItem)
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const invalidation = vi.spyOn(client, 'invalidateQueries');
    await showPage();
    await act(async () => submitForm());
    vi.mocked(useAuth).mockReturnValue({ status: 'authed', user: { id: 8 } } as ReturnType<
      typeof useAuth
    >);
    await act(async () => renderPage());
    await act(async () => submitForm());
    expect(shopApi.addCartItem).toHaveBeenCalledTimes(2);
    await act(async () => oldRequest.resolve(cartView));
    expect(invalidation).not.toHaveBeenCalled();
    expect(signalCartAdded).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('به سبد خرید اضافه شد.');
    await act(async () => newRequest.resolve(cartView));
    expect(invalidation).toHaveBeenCalledWith({ queryKey: queryKeys.cart });
    expect(signalCartAdded).toHaveBeenCalledTimes(1);
    expect(signalCartAdded).toHaveBeenCalledWith(expect.objectContaining({ userId: 8 }));
  });

  it('does not signal a cart animation when the server rejects the addition', async () => {
    vi.mocked(shopApi.addCartItem).mockRejectedValue(new Error('stock changed'));
    await showPage();
    await act(async () => submitForm());
    expect(signalCartAdded).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('به سبد خرید اضافه شد.');
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('drops late favorite errors after account change without invalidating the next account cache', async () => {
    const pending = deferred<void>();
    vi.mocked(shopApi.addFavorite).mockReturnValue(pending.promise);
    const invalidation = vi.spyOn(client, 'invalidateQueries');
    await showPage();
    await vi.waitFor(() => {
      const favorite = [...container.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('افزودن به علاقه‌مندی‌ها'),
      )!;
      expect(favorite.disabled).toBe(false);
    });
    await act(async () => {
      const favorite = [...container.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('افزودن به علاقه‌مندی‌ها'),
      )!;
      favorite.click();
      favorite.click();
    });
    expect(shopApi.addFavorite).toHaveBeenCalledTimes(1);
    vi.mocked(useAuth).mockReturnValue({ status: 'guest', user: null } as ReturnType<
      typeof useAuth
    >);
    await act(async () => renderPage());
    await act(async () => pending.reject(new Error('old account')));
    expect(invalidation).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('old account');
  });

  it('does not invalidate cart data for a late response after unmount', async () => {
    const pending = deferred<CartView>();
    vi.mocked(shopApi.addCartItem).mockReturnValue(pending.promise);
    const invalidation = vi.spyOn(client, 'invalidateQueries');
    await showPage();
    await act(async () => submitForm());
    await act(async () => root.unmount());
    mounted = false;
    await act(async () => pending.resolve(cartView));
    expect(invalidation).not.toHaveBeenCalled();
  });

  it('does not store a late private favorites response after becoming a guest', async () => {
    const pending = deferred<Awaited<ReturnType<typeof shopApi.favorites>>>();
    vi.mocked(shopApi.favorites).mockReturnValue(pending.promise);
    await showPage();
    vi.mocked(useAuth).mockReturnValue({ status: 'guest', user: null } as ReturnType<
      typeof useAuth
    >);
    await act(async () => renderPage());
    await act(async () => pending.resolve({ data: [] }));
    expect(client.getQueryData(['favorites', 'membership', detail.id])).toBeUndefined();
  });

  it('waits for membership on later favorites pages before choosing the correct toggle action', async () => {
    const secondPage = deferred<Awaited<ReturnType<typeof shopApi.favorites>>>();
    vi.mocked(shopApi.favorites)
      .mockResolvedValueOnce({ data: [], meta: { page: 1, limit: 50, total: 51, totalPages: 2 } })
      .mockReturnValue(secondPage.promise);
    await showPage();
    await vi.waitFor(() => expect(shopApi.favorites).toHaveBeenCalledWith(2, 50));
    const favorite = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('افزودن به علاقه‌مندی‌ها'),
    )!;
    expect(favorite.disabled).toBe(true);
    await act(async () => favorite.click());
    expect(shopApi.addFavorite).not.toHaveBeenCalled();
    expect(shopApi.removeFavorite).not.toHaveBeenCalled();
    expect(shopApi.favorites).toHaveBeenCalledWith(1, 50);
    await act(async () =>
      secondPage.resolve({
        data: [
          {
            id: detail.id,
            name: detail.name,
            slug: detail.slug,
            brand: detail.brand,
            image: null,
            minPrice: 100_000,
            inStock: true,
            lifeStage: detail.lifeStage,
            sizeClass: detail.sizeClass,
          },
        ],
        meta: { page: 2, limit: 50, total: 51, totalPages: 2 },
      }),
    );
    await vi.waitFor(() => expect(favorite.disabled).toBe(false));
    expect(favorite.textContent).toBe('حذف از علاقه‌مندی‌ها');
    await act(async () => favorite.click());
    expect(shopApi.removeFavorite).toHaveBeenCalledWith(detail.id);
    expect(shopApi.addFavorite).not.toHaveBeenCalled();
  });

  it('keeps unsafe gallery URLs out of the DOM and lets customers select ordered safe images', async () => {
    vi.mocked(shopApi.product).mockResolvedValue({
      ...detail,
      images: [
        { id: 10, url: 'https://untrusted.example/track.webp', sortOrder: -10 },
        { id: 11, url: '/uploads/product-second.webp', sortOrder: 20 },
        { id: 12, url: '/brand/product-first.webp', sortOrder: 10 },
        { id: 13, url: 'javascript:alert(1)', sortOrder: 0 },
      ],
    });
    await showPage();
    let mainImage = container.querySelector<HTMLImageElement>('.product-detail__media img')!;
    const thumbnails = [
      ...container.querySelectorAll<HTMLButtonElement>('.product-detail__thumbnails button'),
    ];
    expect(thumbnails).toHaveLength(2);
    expect(mainImage.src).toMatch(/\/brand\/product-first\.webp$/);
    expect(thumbnails[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(thumbnails[1]?.getAttribute('aria-pressed')).toBe('false');
    expect(
      [...container.querySelectorAll('img')].every(
        (image) => !image.src.includes('untrusted.example') && !image.src.startsWith('javascript:'),
      ),
    ).toBe(true);
    expect(mainImage.getAttribute('referrerpolicy')).toBe('no-referrer');
    await act(async () => thumbnails[1]?.click());
    mainImage = container.querySelector<HTMLImageElement>('.product-detail__media img')!;
    expect(mainImage.src).toMatch(/\/uploads\/product-second\.webp$/);
    expect(thumbnails[0]?.getAttribute('aria-pressed')).toBe('false');
    expect(thumbnails[1]?.getAttribute('aria-pressed')).toBe('true');
  });

  it('initially chooses the first purchasable variant while respecting a later explicit unavailable selection', async () => {
    vi.mocked(shopApi.product).mockResolvedValue({
      ...detail,
      variants: [detail.variants[1]!, detail.variants[0]!],
    });
    await showPage();
    expect(container.querySelector<HTMLInputElement>('input[value="11"]')?.checked).toBe(true);
    await act(async () => submitForm());
    expect(shopApi.addCartItem).toHaveBeenCalledWith(11, 1);
    await act(async () => container.querySelector<HTMLInputElement>('input[value="12"]')!.click());
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
      true,
    );
  });

  it('exposes favorite pressed state and a completion message after saving', async () => {
    await showPage();
    const favorite = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'افزودن به علاقه‌مندی‌ها',
    )!;
    await vi.waitFor(() => expect(favorite.disabled).toBe(false));
    expect(favorite.getAttribute('aria-pressed')).toBe('false');
    await act(async () => favorite.click());
    expect(shopApi.addFavorite).toHaveBeenCalledWith(detail.id);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'محصول در علاقه‌مندی‌ها ذخیره شد.',
    );
  });

  it('opens an accessible image viewer and returns focus to its trigger after Escape', async () => {
    vi.mocked(shopApi.product).mockResolvedValue({
      ...detail,
      images: [{ id: 12, url: '/brand/product.webp', sortOrder: 0 }],
    });
    await showPage();
    const trigger = container.querySelector<HTMLButtonElement>('.commerce-gallery-open')!;
    await act(async () => {
      trigger.focus();
      trigger.click();
    });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.querySelector('img')?.getAttribute('src')).toContain('/brand/product.webp');
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
