// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, StrictMode, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { storefrontApi, type StorefrontPopup } from '../api/endpoints-storefront';
import { saveConsent } from '../privacy/consent';

const { popupRequest } = vi.hoisted(() => ({ popupRequest: vi.fn() }));
vi.mock('../api/endpoints-storefront', async importOriginal => {
  const actual = await importOriginal<typeof import('../api/endpoints-storefront')>();
  return { ...actual, storefrontApi: { popup: popupRequest } };
});
let VisitPopup: typeof import('./VisitPopup')['VisitPopup'];

const VISIT_KEY = 'drgupet.popup.visit.v1';
const content: StorefrontPopup = { enabled: true, title: 'تازه‌های فروشگاه', body: 'پیشنهادهای تازه را ببینید.', image: '/uploads/popup.webp' };
let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

function Harness({ show }: { show: boolean }) {
  const navigate = useNavigate();
  return <>
    <main><h1>فروشگاه</h1><button id="page-focus" type="button">فهرست محصولات</button></main>
    <button type="button" data-route="products" onClick={() => navigate('/products')}>محصولات</button>
    <button type="button" data-route="home" onClick={() => navigate('/')}>خانه</button>
    <button type="button" data-route="back" onClick={() => navigate(-1)}>بازگشت</button>
    {show && <VisitPopup />}
  </>;
}
function tree({ path = '/', show = true, strict = false }: { path?: string; show?: boolean; strict?: boolean } = {}) {
  const app: ReactNode = <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Harness show={show} /></MemoryRouter></QueryClientProvider>;
  return strict ? <StrictMode>{app}</StrictMode> : app;
}
async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
}
async function render(options?: Parameters<typeof tree>[0]) {
  await act(async () => root.render(tree(options)));
  await flush();
}
async function route(target: 'products' | 'home' | 'back') {
  await act(async () => host.querySelector<HTMLButtonElement>(`[data-route="${target}"]`)!.click());
  await flush();
}
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(ok => { resolve = ok; });
  return { promise, resolve };
}

beforeEach(async () => {
  // Each case is a fresh browser document, including the in-memory storage fallback.
  vi.resetModules();
  ({ VisitPopup } = await import('./VisitPopup'));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear(); localStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  popupRequest.mockResolvedValue(content);
  host = document.createElement('div'); host.id = 'root'; document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear(); host.remove();
  document.querySelectorAll('.landing-bootstrap').forEach(node => node.remove());
  vi.restoreAllMocks(); popupRequest.mockReset(); sessionStorage.clear(); localStorage.clear(); vi.unstubAllGlobals();
});

it.each(['accepted', 'denied'] as const)('waits for the existing %s cookie choice before requesting or displaying the popup', async choice => {
  await render();
  expect(storefrontApi.popup).not.toHaveBeenCalled(); expect(dialog()).toBeNull();
  await act(async () => { expect(saveConsent(choice)).toBe(true); });
  await flush();
  expect(storefrontApi.popup).toHaveBeenCalledOnce();
  expect(dialog()?.textContent).toContain(content.title);
  expect(sessionStorage.getItem(VISIT_KEY)).toBe('seen');
});

it('does not request on other pages and does not reopen when returning home after an open popup', async () => {
  saveConsent('denied');
  await render({ path: '/products' });
  expect(storefrontApi.popup).not.toHaveBeenCalled(); expect(dialog()).toBeNull();
  await route('home');
  expect(dialog()).not.toBeNull();
  await route('products'); expect(dialog()).toBeNull();
  // Back restores the same homepage history entry, rather than creating a new key.
  await route('back'); expect(dialog()).toBeNull();
  expect(storefrontApi.popup).toHaveBeenCalledOnce();
});

it('waits for both popup data and first-entry loading, and works under StrictMode', async () => {
  const pending = deferred<StorefrontPopup>();
  vi.mocked(storefrontApi.popup).mockReturnValue(pending.promise);
  saveConsent('accepted');
  const bootstrap = document.createElement('div'); bootstrap.className = 'landing-bootstrap'; document.body.append(bootstrap);
  await render({ strict: true });
  expect(dialog()).toBeNull(); expect(sessionStorage.getItem(VISIT_KEY)).toBeNull();
  await act(async () => pending.resolve(content)); await flush();
  expect(dialog()).toBeNull(); expect(sessionStorage.getItem(VISIT_KEY)).toBeNull();
  await act(async () => bootstrap.remove()); await flush();
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  expect(sessionStorage.getItem(VISIT_KEY)).toBe('seen');
  expect(storefrontApi.popup).toHaveBeenCalledOnce();
});

it('closes with Escape, traps focus while open, and restores focus to its previous control', async () => {
  const pending = deferred<StorefrontPopup>();
  vi.mocked(storefrontApi.popup).mockReturnValue(pending.promise);
  saveConsent('accepted'); await render();
  const opener = host.querySelector<HTMLButtonElement>('#page-focus')!; opener.focus();
  await act(async () => pending.resolve(content)); await flush();
  const close = dialog()!.querySelector<HTMLButtonElement>('[aria-label="بستن پنجره"]')!;
  const acknowledge = dialog()!.querySelector<HTMLButtonElement>('.visit-popup button')!;
  expect(document.activeElement).toBe(close);
  expect(document.body.style.overflow).toBe('hidden');
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })));
  expect(document.activeElement).toBe(acknowledge);
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
  expect(document.activeElement).toBe(close);
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(dialog()).toBeNull(); expect(document.activeElement).toBe(opener);
  expect(document.body.style.overflow).not.toBe('hidden');
});

it('keeps a failed image dismissible without losing text or replaying the visit', async () => {
    saveConsent('accepted'); await render();
    const image = dialog()!.querySelector<HTMLImageElement>('.visit-popup img')!;
    await act(async () => image.dispatchEvent(new Event('error')));
    const fallback = dialog()!.querySelector<HTMLElement>('.safe-image-fallback')!;
    expect(fallback).not.toBeNull();
    // Actual mobile replacement dimensions are checked in browser review.
    expect(fallback.getAttribute('aria-hidden')).toBe('true');
    expect(dialog()?.textContent).toContain(content.title);
    expect(dialog()?.textContent).toContain(content.body);
    await act(async () => dialog()!.querySelector<HTMLButtonElement>('.visit-popup button')!.click());
    expect(dialog()).toBeNull(); await render({ show: false }); await render();
    expect(dialog()).toBeNull(); expect(storefrontApi.popup).toHaveBeenCalledOnce();
});

it('stays dismissed after a remount and a new application/query-client instance in the same tab visit', async () => {
  saveConsent('accepted'); await render();
  await act(async () => dialog()!.querySelector<HTMLButtonElement>('.visit-popup button')!.click());
  await render({ show: false }); await render();
  expect(dialog()).toBeNull();
  await act(async () => root.unmount()); client.clear();
  // A reload resets module memory; the session record alone must prevent replay.
  vi.resetModules(); ({ VisitPopup } = await import('./VisitPopup'));
  root = createRoot(host); client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render();
  expect(dialog()).toBeNull(); expect(storefrontApi.popup).toHaveBeenCalledOnce();
});

it.each(['writes', 'reads-and-writes'] as const)('keeps one-visit memory when session storage denies %s', async mode => {
  saveConsent('denied');
  const originalGet = Storage.prototype.getItem;
  const originalSet = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
    if (this === sessionStorage && key === VISIT_KEY && mode === 'reads-and-writes') throw new DOMException('Denied', 'SecurityError');
    return originalGet.call(this, key);
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (this === sessionStorage && key === VISIT_KEY) throw new DOMException('Denied', 'SecurityError');
    return originalSet.call(this, key, value);
  });
  await render(); expect(dialog()).not.toBeNull();
  await act(async () => dialog()!.querySelector<HTMLButtonElement>('.visit-popup button')!.click());
  await render({ show: false }); await render();
  expect(dialog()).toBeNull(); expect(storefrontApi.popup).toHaveBeenCalledOnce();
});

it.each([
  { ...content, enabled: false },
  { ...content, title: '', body: ' ', image: '' },
  { ...content, title: 'a'.repeat(91) },
  { ...content, body: 'a'.repeat(801) },
  { ...content, image: 'https://tracking.example/pixel.png' },
  { ...content, image: '//tracking.example/pixel.png' },
  { ...content, image: '/uploads/../private/a.png' },
  { ...content, image: '/uploads/active.svg' },
  { ...content, image: '/uploads/a.png?track=1' },
])('does not render disabled or invalid content %# or consume its visit', async invalid => {
  vi.mocked(storefrontApi.popup).mockResolvedValue(invalid);
  saveConsent('accepted'); await render();
  expect(dialog()).toBeNull(); expect(document.querySelector('.visit-popup img')).toBeNull();
  expect(sessionStorage.getItem(VISIT_KEY)).toBeNull();
});

it.each([
  { title: '', body: '', image: content.image },
  { title: '', body: content.body, image: '' },
  { title: content.title, body: '', image: '' },
])('supports optional title and body while keeping an accessible, dismissible dialog %#', async partial => {
  popupRequest.mockResolvedValue({ enabled: true, ...partial });
  saveConsent('denied'); await render();
  const panel = dialog()!;
  expect(panel).not.toBeNull();
  const heading = document.getElementById(panel.getAttribute('aria-labelledby')!);
  expect(heading?.textContent).toBe(partial.title || 'پیام فروشگاه');
  expect(heading?.classList.contains('sr-only')).toBe(!partial.title);
  expect(panel.querySelector('.visit-popup p')?.textContent ?? '').toBe(partial.body);
  if (!partial.title && !partial.body) {
    expect(panel.querySelector('.visit-popup img')).not.toBeNull();
    expect(panel.querySelector('.visit-popup button')).toBeNull();
  }
  await act(async () => panel.querySelector<HTMLButtonElement>('[aria-label="بستن پنجره"]')!.click());
  expect(dialog()).toBeNull();
  await render({ show: false }); await render(); expect(dialog()).toBeNull();
});

it('explains a failed image-only announcement and keeps an explicit dismiss action', async () => {
  popupRequest.mockResolvedValue({ enabled: true, title: '', body: '', image: content.image });
  saveConsent('denied'); await render();
  const img = dialog()!.querySelector<HTMLImageElement>('img')!;
  expect(img.alt).toBe('پیام تصویری فروشگاه');
  await act(async () => img.dispatchEvent(new Event('error')));
  expect(dialog()?.querySelector('[role=status]')?.textContent).toBe('تصویر پیام بارگذاری نشد.');
  await act(async () => dialog()!.querySelector<HTMLButtonElement>('.visit-popup button')!.click());
  expect(dialog()).toBeNull();
});

it('quietly ignores a failed public request without marking the visit seen', async () => {
  vi.mocked(storefrontApi.popup).mockRejectedValue(new Error('offline'));
  saveConsent('accepted'); await render();
  expect(dialog()).toBeNull(); expect(sessionStorage.getItem(VISIT_KEY)).toBeNull();
});
