// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProductCardView } from './ProductCardView';
import type { ProductCard, ProductDetail } from '../api/types';
import { shopApi } from '../api/endpoints-shop';
import { signalCartAdded } from '../features/cart/cart-feedback';
import {
  addGuestCartItem,
  beginGuestTransfer,
  clearGuestCart,
  finishGuestTransfer,
  readGuestCart,
  setGuestTransferPhase,
} from '../features/cart/guest-cart';

const auth = vi.hoisted(() => ({ status: 'authed', user: { id: 7 } as { id: number } | null }));
vi.mock('../auth/auth-provider', () => ({ useAuth: () => auth }));
vi.mock('../api/endpoints-shop', () => ({ shopApi: { product: vi.fn(), addCartItem: vi.fn() } }));
vi.mock('../features/cart/cart-feedback', () => ({ signalCartAdded: vi.fn() }));

let root: Root | undefined;
let container: HTMLDivElement;
let client: QueryClient;
beforeEach(() => {
  auth.status = 'authed';
  auth.user = { id: 7 };
  vi.clearAllMocks();
  localStorage.clear();
  clearGuestCart();
});
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  client?.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const card: ProductCard = {
  id: 1,
  name: 'غذا',
  slug: 'food',
  brand: { id: 1, name: 'برند' },
  image: '/brand/landing-meal-mobile.webp',
  hoverImage: '/brand/landing-treat-mobile.webp',
  minPrice: 10,
  inStock: true,
  lifeStage: 'ALL',
  sizeClass: 'ALL',
};
async function mount(value = card, fine = true) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: fine }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProductCardView card={value} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}
it('does not request the alternate until fine-pointer hover and keeps the primary on failure', async () => {
  await mount();
  expect(container.querySelectorAll('img')).toHaveLength(1);
  const media = container.querySelector('.product-card__media')!;
  await act(async () => media.dispatchEvent(new Event('pointerenter', { bubbles: true })));
  // React pointer-enter is derived from pointer-over.
  await act(async () => media.dispatchEvent(new Event('pointerover', { bubbles: true })));
  const alternate = container.querySelector<HTMLImageElement>('.product-card__alternate');
  expect(alternate).not.toBeNull();
  expect(media.getAttribute('data-alternate-ready')).toBe('false');
  await act(async () => alternate!.dispatchEvent(new Event('load')));
  expect(media.getAttribute('data-alternate-ready')).toBe('true');
  await act(async () => alternate!.dispatchEvent(new Event('error')));
  expect(media.getAttribute('data-alternate-ready')).toBe('false');
  expect(new URL(container.querySelector('img')!.src).pathname).toBe(card.image);
});
it.each([undefined, null, 'https://untrusted.example/image.webp'])(
  'ignores absent or untrusted alternate %s',
  async (hoverImage) => {
    await mount({ ...card, hoverImage });
    await act(async () =>
      container
        .querySelector('.product-card__media')!
        .dispatchEvent(new Event('pointerover', { bubbles: true })),
    );
    expect(container.querySelectorAll('img')).toHaveLength(1);
  },
);
it('does not fetch an alternate for a touch/coarse surface', async () => {
  await mount(card, false);
  await act(async () =>
    container
      .querySelector('.product-card__media')!
      .dispatchEvent(new Event('pointerover', { bubbles: true })),
  );
  expect(container.querySelectorAll('img')).toHaveLength(1);
});
it('shows the API animal type and age above the price footer, with the brand directly below the title', async () => {
  await mount({
    ...card,
    petType: { id: 3, name: 'گربه' },
    lifeStage: 'ADULT',
    compareAtPrice: 15,
  });
  const title = container.querySelector('h3')!;
  expect(title.nextElementSibling?.className).toBe('product-card__brand');
  expect(title.nextElementSibling?.textContent).toBe('برند');
  const metadata = container.querySelector('.product-card__meta')!;
  expect(metadata.textContent).toContain('گربه (بالغ)');
  expect(metadata.closest('a')?.nextElementSibling?.className).toBe('product-card__bottom');
  const footer = container.querySelector('.product-card__bottom')!;
  expect(footer.querySelector('.product-card__price')).not.toBeNull();
  expect(footer.querySelector('del')?.textContent).toContain('۱۵');
  expect(footer.textContent).not.toContain('موجود');
});
it.each([{ inStock: false }, { inStock: true, isSample: true }])(
  'hides both prices for unavailable or sample cards: %j',
  async (unavailable) => {
    await mount({ ...card, ...unavailable, compareAtPrice: 15 });
    const footer = container.querySelector('.product-card__bottom')!;
    expect(footer.textContent).toBe('ناموجود');
    expect(container.querySelector('.product-card__price')).toBeNull();
    expect(container.querySelector('del')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/products/food');
  },
);
it('retains age metadata for older responses without guessing an animal type from the name', async () => {
  await mount({ ...card, name: 'خوراک گربه', lifeStage: 'SENIOR' });
  expect(container.querySelector('.product-card__meta')?.textContent?.trim()).toBe('سالمند');
});

const detail: ProductDetail = {
  ...card,
  description: null,
  ingredientsText: null,
  isActive: true,
  createdAt: '',
  updatedAt: '',
  neuterSuitability: 'ANY',
  brand: { ...card.brand, slug: 'brand' },
  category: { id: 2, name: 'غذا', slug: 'food' },
  petType: { id: 3, name: 'گربه', slug: 'cat' },
  images: [],
  tags: [],
  variants: [
    {
      id: 11,
      sku: 'FOOD-500',
      weightGram: 500,
      price: 10,
      compareAtPrice: null,
      inStock: true,
      lowStock: false,
    },
  ],
};
async function clickBasket() {
  await act(async () =>
    container.querySelector<HTMLButtonElement>('.product-card__basket')!.click(),
  );
}

it('aligns the Toman unit before the numeric amount and derives a real discount without creating a rating', async () => {
  await mount({ ...card, minPrice: 120_000, compareAtPrice: 150_000 });
  const price = container.querySelector('.product-card__price')!;
  expect(price.getAttribute('dir')).toBe('ltr');
  expect(price.firstElementChild?.textContent).toBe('تومان');
  expect(price.lastElementChild?.textContent).toBe('۱۲۰٬۰۰۰');
  expect(container.querySelector('.product-card__discount')?.textContent).toBe('۲۰٪');
  expect(container.querySelector('.product-card__sale')?.textContent).toBe('فروش ویژه');
  expect(container.querySelector('[aria-label*="امتیاز"]')).toBeNull();
  expect(container.querySelector('a .product-card__basket')).toBeNull();
});
it.each([undefined, null, 10, 9, NaN])(
  'does not manufacture a promotion for compare price %s',
  async (compareAtPrice) => {
    await mount({ ...card, compareAtPrice });
    expect(container.querySelector('.product-card__discount')).toBeNull();
    expect(container.querySelector('.product-card__sale')).toBeNull();
  },
);
it('defers detail loading until basket interaction and adds the sole available variant after authentication', async () => {
  vi.mocked(shopApi.product).mockResolvedValue({
    ...detail,
    variants: [{ ...detail.variants[0]!, id: 10, inStock: false }, detail.variants[0]!],
  });
  vi.mocked(shopApi.addCartItem).mockResolvedValue({ items: [], itemsTotal: 10 });
  await mount();
  expect(shopApi.product).not.toHaveBeenCalled();
  await clickBasket();
  await vi.waitFor(() => expect(shopApi.addCartItem).toHaveBeenCalledWith(11, 1));
  await vi.waitFor(() => expect(signalCartAdded).toHaveBeenCalledTimes(1));
  expect(signalCartAdded).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 7, keyboard: true }),
  );
  expect(container.querySelector('[role="status"]')?.textContent).toContain('اضافه شد');
});
it('requires an explicit variant choice when more than one package is available', async () => {
  vi.mocked(shopApi.product).mockResolvedValue({
    ...detail,
    variants: [
      detail.variants[0]!,
      { ...detail.variants[0]!, id: 12, sku: 'FOOD-1000', weightGram: 1000 },
    ],
  });
  vi.mocked(shopApi.addCartItem).mockResolvedValue({ items: [], itemsTotal: 10 });
  await mount();
  await clickBasket();
  await vi.waitFor(() => expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(2));
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
  expect(document.querySelector<HTMLInputElement>('input:checked')).toBeNull();
  const submit = document.querySelector<HTMLButtonElement>('.product-card__choice .ui-button')!;
  expect(submit.disabled).toBe(true);
  await act(async () =>
    document.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]!.click(),
  );
  await act(async () => submit.click());
  await vi.waitFor(() => expect(shopApi.addCartItem).toHaveBeenCalledWith(12, 1));
});
it('adds the sole real available variant to the durable guest cart without requiring login', async () => {
  auth.status = 'guest';
  auth.user = null;
  vi.mocked(shopApi.product).mockResolvedValue(detail);
  await mount();
  expect(shopApi.product).not.toHaveBeenCalled();
  await clickBasket();
  await vi.waitFor(() =>
    expect(readGuestCart()).toEqual([expect.objectContaining({ variantId: 11, quantity: 1 })]),
  );
  expect(shopApi.product).toHaveBeenCalledExactlyOnceWith(card.slug);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(container.querySelector('a[href^="/login"]')).toBeNull();
  expect(signalCartAdded).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ userId: null, keyboard: true }),
  );
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
});

it('requires the guest to select an actual variant when several packages are available', async () => {
  auth.status = 'guest';
  auth.user = null;
  vi.mocked(shopApi.product).mockResolvedValue({
    ...detail,
    variants: [
      detail.variants[0]!,
      { ...detail.variants[0]!, id: 12, sku: 'FOOD-1000', weightGram: 1000 },
    ],
  });
  await mount();
  await clickBasket();
  await vi.waitFor(() => expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(2));
  expect(readGuestCart()).toEqual([]);
  expect(document.querySelector('input:checked')).toBeNull();
  const submit = document.querySelector<HTMLButtonElement>('.product-card__choice .ui-button')!;
  expect(submit.disabled).toBe(true);
  await act(async () =>
    document.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]!.click(),
  );
  await act(async () => submit.click());
  expect(readGuestCart()).toEqual([
    expect.objectContaining({ variantId: 12, quantity: 1, weightGram: 1000 }),
  ]);
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
  expect(signalCartAdded).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ userId: null }),
  );
});

it('reports a guest storage failure without false success and allows an explicit retry', async () => {
  auth.status = 'guest';
  auth.user = null;
  vi.mocked(shopApi.product).mockResolvedValue(detail);
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError');
  });
  await mount();
  await clickBasket();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('ذخیرهٔ سبد'),
  );
  expect(readGuestCart()).toEqual([]);
  expect(signalCartAdded).not.toHaveBeenCalled();
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
  write.mockRestore();
  await act(async () =>
    document.querySelector<HTMLButtonElement>('.product-card__choice .ui-button')!.click(),
  );
  expect(readGuestCart()).toEqual([expect.objectContaining({ variantId: 11, quantity: 1 })]);
  expect(signalCartAdded).toHaveBeenCalledTimes(1);
});

it('preserves the real per-item quantity limit for repeated guest additions', async () => {
  auth.status = 'guest';
  auth.user = null;
  addGuestCartItem(detail, detail.variants[0]!, 20);
  vi.mocked(shopApi.product).mockResolvedValue(detail);
  await mount();
  await clickBasket();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('۲۰'),
  );
  expect(readGuestCart()).toEqual([expect.objectContaining({ variantId: 11, quantity: 20 })]);
  expect(signalCartAdded).not.toHaveBeenCalled();
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
});

it('does not reinterpret an unresolved authentication session as a guest cart', async () => {
  auth.status = 'loading';
  auth.user = null;
  await mount();
  await clickBasket();
  expect(shopApi.product).not.toHaveBeenCalled();
  expect(readGuestCart()).toEqual([]);
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
  auth.status = 'guest';
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProductCardView card={card} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  expect(container.querySelector('.product-card__basket')?.getAttribute('aria-busy')).toBeNull();
  expect(readGuestCart()).toEqual([]);
});

it('does not write a guest item or add to a newly logged-in account from a stale detail response', async () => {
  auth.status = 'guest';
  auth.user = null;
  let resolve!: (value: ProductDetail) => void;
  vi.mocked(shopApi.product).mockReturnValue(
    new Promise<ProductDetail>((done) => {
      resolve = done;
    }),
  );
  await mount();
  await clickBasket();
  auth.status = 'authed';
  auth.user = { id: 7 };
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProductCardView card={card} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  await act(async () => resolve(detail));
  expect(readGuestCart()).toEqual([]);
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
  expect(signalCartAdded).not.toHaveBeenCalled();
});

it.each(['draft', 'checkpoint'])(
  'blocks authenticated quick add during guest %s handoff and re-enables it after completion',
  async (state) => {
    addGuestCartItem(detail, detail.variants[0]!, 1);
    const checkpoint = state === 'checkpoint' ? beginGuestTransfer(7) : null;
    vi.mocked(shopApi.product).mockResolvedValue(detail);
    vi.mocked(shopApi.addCartItem).mockResolvedValue({ items: [], itemsTotal: 10 });
    await mount();
    const button = container.querySelector<HTMLButtonElement>('.product-card__basket')!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.product-card__handoff-link')?.getAttribute('href')).toBe(
      '/cart',
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain('انتقال سبد خرید');
    await act(async () => button.click());
    expect(shopApi.product).not.toHaveBeenCalled();
    expect(shopApi.addCartItem).not.toHaveBeenCalled();
    await act(async () => {
      if (checkpoint) {
        setGuestTransferPhase(checkpoint.id, 7, detail.variants[0]!.id, 'done');
        finishGuestTransfer(checkpoint.id, 7);
      } else clearGuestCart();
    });
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBeNull();
    await act(async () => button.click());
    await vi.waitFor(() => expect(shopApi.addCartItem).toHaveBeenCalledExactlyOnceWith(11, 1));
  },
);

it('rechecks the real guest handoff state when a delayed authenticated detail fetch resolves', async () => {
  let resolve!: (value: ProductDetail) => void;
  vi.mocked(shopApi.product).mockReturnValue(
    new Promise<ProductDetail>((done) => {
      resolve = done;
    }),
  );
  await mount();
  await clickBasket();
  expect(shopApi.product).toHaveBeenCalledExactlyOnceWith(card.slug);
  await act(async () => addGuestCartItem(detail, detail.variants[0]!, 1));
  await act(async () => resolve(detail));
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
  expect(signalCartAdded).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('ابتدا انتقال سبد خرید');
  expect(document.querySelector('[role="dialog"] a')?.getAttribute('href')).toBe('/cart');
});
it('honors current stock from detail and shows server errors without announcing a successful addition', async () => {
  vi.mocked(shopApi.product).mockResolvedValue({
    ...detail,
    variants: [{ ...detail.variants[0]!, inStock: false }],
  });
  await mount();
  await clickBasket();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('ناموجود'),
  );
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
  expect(signalCartAdded).not.toHaveBeenCalled();
});
it('does not add a stale detail response after the card unmounts', async () => {
  let resolve!: (value: ProductDetail) => void;
  vi.mocked(shopApi.product).mockReturnValue(
    new Promise<ProductDetail>((done) => {
      resolve = done;
    }),
  );
  await mount();
  await clickBasket();
  await act(async () => root!.render(<div />));
  await act(async () => resolve(detail));
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
  expect(signalCartAdded).not.toHaveBeenCalled();
});

it('prevents repeated additions while waiting and signals success only after confirmation', async () => {
  let resolve!: (value: { items: []; itemsTotal: number }) => void;
  vi.mocked(shopApi.product).mockResolvedValue(detail);
  vi.mocked(shopApi.addCartItem).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await mount();
  await clickBasket();
  await vi.waitFor(() => expect(shopApi.addCartItem).toHaveBeenCalledTimes(1));
  await clickBasket();
  expect(shopApi.addCartItem).toHaveBeenCalledTimes(1);
  expect(signalCartAdded).not.toHaveBeenCalled();
  await act(async () => resolve({ items: [], itemsTotal: 10 }));
  expect(signalCartAdded).toHaveBeenCalledTimes(1);
});

it('keeps a rejected addition recoverable without generating basket success feedback', async () => {
  vi.mocked(shopApi.product).mockResolvedValue(detail);
  vi.mocked(shopApi.addCartItem).mockRejectedValue(new Error('موجودی تغییر کرده است'));
  await mount();
  await clickBasket();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'موجودی تغییر کرده است',
    ),
  );
  expect(signalCartAdded).not.toHaveBeenCalled();
  expect(
    document.querySelector<HTMLButtonElement>('.product-card__choice .ui-button')?.disabled,
  ).toBe(false);
});

it('drops an unfinished card action when the account changes', async () => {
  let resolve!: (value: ProductDetail) => void;
  vi.mocked(shopApi.product).mockReturnValue(
    new Promise<ProductDetail>((done) => {
      resolve = done;
    }),
  );
  await mount();
  await clickBasket();
  auth.user = { id: 8 };
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProductCardView card={card} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  await act(async () => resolve(detail));
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
  expect(signalCartAdded).not.toHaveBeenCalled();
  expect(container.querySelector('.product-card__basket')?.getAttribute('aria-busy')).toBeNull();
});

it('claims quick add before loading so two cards cannot stack dialogs or leave the page locked', async () => {
  let resolveFirst!: (value: ProductDetail) => void;
  let resolveSecond!: (value: ProductDetail) => void;
  const first = new Promise<ProductDetail>((done) => {
    resolveFirst = done;
  });
  const second = new Promise<ProductDetail>((done) => {
    resolveSecond = done;
  });
  const otherCard = { ...card, id: 2, slug: 'other-food', name: 'غذای دوم' };
  const variants = [
    detail.variants[0]!,
    { ...detail.variants[0]!, id: 12, sku: 'FOOD-1000', weightGram: 1000 },
  ];
  vi.mocked(shopApi.product).mockImplementation((slug) => (slug === card.slug ? first : second));
  await mount();
  container.id = 'root';
  const previousOverflow = document.body.style.overflow;
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProductCardView key={card.id} card={card} />
          <ProductCardView key={otherCard.id} card={otherCard} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  const buttons = container.querySelectorAll<HTMLButtonElement>('.product-card__basket');
  await act(async () => {
    buttons[0]!.focus();
    buttons[0]!.click();
  });
  await act(async () => buttons[1]!.click());
  expect(shopApi.product).toHaveBeenCalledTimes(1);
  expect(shopApi.product).toHaveBeenCalledWith(card.slug);
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
  await act(async () => {
    resolveFirst({ ...detail, variants });
    resolveSecond({
      ...detail,
      ...otherCard,
      brand: detail.brand,
      petType: detail.petType,
      variants,
    });
  });
  await vi.waitFor(() => expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1));
  expect(container.inert).toBe(true);
  expect(document.body.style.overflow).toBe('hidden');
  await act(async () =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
  );
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
  expect(container.inert).toBe(false);
  expect(document.body.style.overflow).toBe(previousOverflow);
  expect(document.activeElement).toBe(buttons[0]);
  await act(async () => buttons[1]!.click());
  await vi.waitFor(() => expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1));
  expect(shopApi.product).toHaveBeenCalledWith(otherCard.slug);
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(otherCard.name);
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
  await act(async () =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
  );
  expect(container.inert).toBe(false);
  expect(document.body.style.overflow).toBe(previousOverflow);
});

it('releases a pending card claim on unmount and ignores its late detail response', async () => {
  let resolveFirst!: (value: ProductDetail) => void;
  const first = new Promise<ProductDetail>((done) => {
    resolveFirst = done;
  });
  const otherCard = { ...card, id: 2, slug: 'other-food' };
  const variants = [detail.variants[0]!, { ...detail.variants[0]!, id: 12, weightGram: 1000 }];
  vi.mocked(shopApi.product).mockImplementation((slug) =>
    slug === card.slug
      ? first
      : Promise.resolve({
          ...detail,
          ...otherCard,
          brand: detail.brand,
          petType: detail.petType,
          variants,
        }),
  );
  await mount();
  await clickBasket();
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProductCardView key={otherCard.id} card={otherCard} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  await clickBasket();
  await act(async () => resolveFirst({ ...detail, variants }));
  await vi.waitFor(() => expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1));
  expect(shopApi.product).toHaveBeenCalledWith(otherCard.slug);
  expect(shopApi.addCartItem).not.toHaveBeenCalled();
});
