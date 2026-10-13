// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { SafeImage } from './SafeImage';
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it('replaces a failed informative image and retries when the source changes', async () => {
  await act(async () => root.render(<SafeImage src="/first.jpg" alt="باران" className="account-pet-photo" width="96" height="96" />));
  await act(async () => container.querySelector('img')!.dispatchEvent(new Event('error')));
  const fallback = container.querySelector<HTMLElement>('[role="img"]')!;
  expect(fallback.getAttribute('aria-label')).toContain('باران');
  expect(fallback.style.width).toBe('');
  await act(async () => root.render(<SafeImage src="/next.jpg" alt="باران" />));
  expect(container.querySelector('img')?.getAttribute('src')).toBe('/next.jpg');
});
it('keeps decorative failures out of the accessibility tree and normalizes attribute dimensions', async () => {
  await act(async () => root.render(<SafeImage src="/first.jpg" alt="" width="96" height={76} />));
  await act(async () => container.querySelector('img')!.dispatchEvent(new Event('error')));
  const fallback = container.querySelector<HTMLElement>('span')!;
  expect(fallback.getAttribute('aria-hidden')).toBe('true');
  expect(fallback.style.width).toBe('96px');
  expect(fallback.style.height).toBe('76px');
});
it('uses known responsive derivatives while preserving an explicit caller image set and display size', async () => {
  await act(async () => root.render(<SafeImage src="/brand/landing-family-mobile.webp" sizes="160px" alt="" />));
  expect(container.querySelector('img')?.getAttribute('srcset')).toContain('mobile-480.webp 480w');
  expect(container.querySelector('img')?.getAttribute('sizes')).toBe('160px');
  await act(async () => root.render(<SafeImage src="/brand/landing-family-mobile.webp" srcSet="/custom.webp 480w" sizes="240px" alt="" />));
  expect(container.querySelector('img')?.getAttribute('srcset')).toBe('/custom.webp 480w');
  expect(container.querySelector('img')?.getAttribute('sizes')).toBe('240px');
});
