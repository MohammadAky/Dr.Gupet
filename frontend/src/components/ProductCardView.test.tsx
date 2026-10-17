// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ProductCardView } from './ProductCardView';
import type { ProductCard } from '../api/types';

let root: Root | undefined;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
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
  await act(async () =>
    root!.render(
      <MemoryRouter>
        <ProductCardView card={value} />
      </MemoryRouter>,
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
  expect(metadata.nextElementSibling?.className).toBe('product-card__bottom');
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
