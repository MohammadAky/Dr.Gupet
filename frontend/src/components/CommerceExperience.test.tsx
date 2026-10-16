// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CartView } from '../api/types';
import { FREE_SHIPPING_THRESHOLD } from '../lib/constants';
import { CommerceSteps, type CommerceStage } from './CommerceSteps';
import { ShippingProgress } from './ShippingProgress';
import { EmptyCartIllustration } from './EmptyCartIllustration';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function shipping(total: number, threshold?: number, cost?: number) {
  const cart: CartView = { items: [], itemsTotal: total,
    ...(threshold !== undefined ? { estimate: { itemsTotal: total, freeShippingThreshold: threshold, shippingCost: cost ?? 50_000, note: '' } } : {}) };
  await act(async () => root.render(<ShippingProgress cart={cart} />));
  return host.querySelector('[role="progressbar"]')!;
}

it('uses the server threshold and shipping cost rather than the UI fallback', async () => {
  const bar = await shipping(1_000_000, 2_000_000, 70_000);
  expect(bar.getAttribute('aria-valuenow')).toBe('50');
  expect(host.textContent).toContain('برآورد سامانه');
  expect(host.textContent).not.toContain('ارسال برآوردی رایگان است');
  await shipping(1_000_000, 2_000_000, 0);
  expect(host.textContent).toContain('ارسال برآوردی رایگان است');
});
it('does not promise free delivery merely because a threshold is met while server cost is positive', async () => {
  const bar = await shipping(3_000_000, 2_000_000, 70_000);
  expect(bar.getAttribute('aria-valuenow')).toBe('100');
  expect(host.textContent).toContain('هزینهٔ ارسال را در خلاصه بررسی کنید');
  expect(host.textContent).not.toContain('ارسال برآوردی رایگان است');
});
it('marks missing/invalid threshold as fallback and guards a valid zero threshold', async () => {
  let bar = await shipping(FREE_SHIPPING_THRESHOLD / 2);
  expect(bar.getAttribute('aria-valuenow')).toBe('50');
  expect(host.textContent).toContain('برآورد اولیه');
  bar = await shipping(FREE_SHIPPING_THRESHOLD / 2, -1, 0);
  expect(bar.getAttribute('aria-valuenow')).toBe('50');
  expect(host.textContent).toContain('برآورد اولیه');
  bar = await shipping(0, 0, 0);
  expect(bar.getAttribute('aria-valuenow')).toBe('100');
  expect(host.innerHTML).not.toContain('NaN');
});
it('celebrates a confirmed free-shipping crossing once, without replaying on a refetch', async () => {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  await shipping(1_000_000, 2_000_000, 70_000);
  const cancel = vi.fn();
  const animate = vi.fn<(frames: Keyframe[], options: KeyframeAnimationOptions) => Pick<Animation, 'cancel'>>().mockReturnValue({ cancel });
  Object.defineProperty(host.querySelector('svg'), 'animate', { value: animate });
  await shipping(2_000_000, 2_000_000, 0);
  expect(animate).toHaveBeenCalledOnce();
  expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 680 });
  expect(host.querySelector('.commerce-shipping')?.getAttribute('data-eligible')).toBe('true');
  await shipping(2_500_000, 2_000_000, 0);
  expect(animate).toHaveBeenCalledOnce();
  expect(cancel).not.toHaveBeenCalled();
});
it('keeps the truck still on initial free eligibility, positive server cost, and reduced motion', async () => {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  await shipping(2_000_000, 2_000_000, 0);
  const animate = vi.fn();
  Object.defineProperty(host.querySelector('svg'), 'animate', { value: animate });
  await shipping(1_000_000, 2_000_000, 70_000);
  await shipping(2_000_000, 2_000_000, 70_000);
  expect(host.querySelector('.commerce-shipping')?.getAttribute('data-eligible')).toBe('false');
  await shipping(2_000_000, 2_000_000, 0);
  expect(animate).not.toHaveBeenCalled();
});
it('has exactly one current stage and never marks payment complete during gateway handoff', async () => {
  for (const stage of ['cart', 'delivery', 'payment'] as CommerceStage[]) {
    await act(async () => root.render(<MemoryRouter><CommerceSteps current={stage} /></MemoryRouter>));
    expect(host.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    const rows = host.querySelectorAll('li');
    expect(rows[2]?.getAttribute('data-complete')).toBe('false');
    expect(rows[2]?.querySelector('a')).toBeNull();
    expect(rows[0]?.querySelector('a[href="/cart"]') !== null).toBe(stage !== 'cart');
  }
});
it('keeps original empty-cart artwork decorative and avoids additional raster requests', async () => {
  await act(async () => root.render(<EmptyCartIllustration />));
  expect(host.querySelector('[aria-hidden="true"] svg[focusable="false"]')).not.toBeNull();
  expect(host.querySelector('img')).toBeNull();
});
