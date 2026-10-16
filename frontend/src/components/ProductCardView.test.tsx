// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ProductCardView } from './ProductCardView';
import type { ProductCard } from '../api/types';

let root: Root | undefined; let container: HTMLDivElement;
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); vi.unstubAllGlobals(); });
const card: ProductCard = { id: 1, name: 'غذا', slug: 'food', brand: { id: 1, name: 'برند' }, image: '/brand/landing-meal-mobile.webp', hoverImage: '/brand/landing-treat-mobile.webp', minPrice: 10, inStock: true, lifeStage: 'ALL', sizeClass: 'ALL' };
async function mount(value = card, fine = true) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: fine }));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<MemoryRouter><ProductCardView card={value} /></MemoryRouter>));
}
it('does not request the alternate until fine-pointer hover and keeps the primary on failure', async () => {
  await mount(); expect(container.querySelectorAll('img')).toHaveLength(1);
  const media = container.querySelector('.product-card__media')!;
  await act(async () => media.dispatchEvent(new Event('pointerenter', { bubbles: true })));
  // React pointer-enter is derived from pointer-over.
  await act(async () => media.dispatchEvent(new Event('pointerover', { bubbles: true })));
  const alternate = container.querySelector<HTMLImageElement>('.product-card__alternate'); expect(alternate).not.toBeNull();
  expect(media.getAttribute('data-alternate-ready')).toBe('false');
  await act(async () => alternate!.dispatchEvent(new Event('load')));
  expect(media.getAttribute('data-alternate-ready')).toBe('true');
  await act(async () => alternate!.dispatchEvent(new Event('error')));
  expect(media.getAttribute('data-alternate-ready')).toBe('false');
  expect(new URL(container.querySelector('img')!.src).pathname).toBe(card.image);
});
it.each([undefined, null, 'https://untrusted.example/image.webp'])('ignores absent or untrusted alternate %s', async hoverImage => {
  await mount({ ...card, hoverImage });
  await act(async () => container.querySelector('.product-card__media')!.dispatchEvent(new Event('pointerover', { bubbles: true })));
  expect(container.querySelectorAll('img')).toHaveLength(1);
});
it('does not fetch an alternate for a touch/coarse surface', async () => {
  await mount(card, false);
  await act(async () => container.querySelector('.product-card__media')!.dispatchEvent(new Event('pointerover', { bubbles: true })));
  expect(container.querySelectorAll('img')).toHaveLength(1);
});
