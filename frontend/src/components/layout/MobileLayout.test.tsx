// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RequireAuth } from '../../auth/guards';
import { Footer } from './Footer';
import { MobileBottomNav } from './MobileBottomNav';

const auth = vi.hoisted(() => ({ status: 'guest' }));
vi.mock('../../auth/auth-provider', () => ({ useAuth: () => auth }));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  auth.status = 'guest';
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove();
  vi.unstubAllGlobals(); vi.useRealTimers();
});
function CurrentPath() {
  const location = useLocation();
  return <output>{location.pathname}{location.search}</output>;
}
function Navigation() {
  return <MemoryRouter><MobileBottomNav status={auth.status === 'authed' ? 'authed' : 'guest'} />
    <Routes>
      <Route path="/favorites" element={<RequireAuth><p>محصولات ذخیره‌شده</p><CurrentPath /></RequireAuth>} />
      <Route path="*" element={<CurrentPath />} />
    </Routes>
  </MemoryRouter>;
}
it('renders the current Persian copyright year and retains separate store/help groups', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-13T10:00:00Z'));
  await act(async () => root.render(<MemoryRouter><Footer /></MemoryRouter>));
  expect(container.querySelector('.footer-bottom')?.textContent).toContain('© ۱۴۰۵');
  expect(container.querySelectorAll('.footer-links')).toHaveLength(2);
  expect(container.querySelectorAll('.footer-links a')).toHaveLength(6);
  expect(container.querySelector('img')?.getAttribute('src')).toBe('/brand/logo.webp');
});
it('uses the next Persian year after Tehran Nowruz rather than a fixed copyright year', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2027-03-21T10:00:00Z'));
  await act(async () => root.render(<MemoryRouter><Footer /></MemoryRouter>));
  expect(container.querySelector('.footer-bottom')?.textContent).toContain('© ۱۴۰۶');
});
it('replaces the pharmacy tab with favorites and retains the guest login return destination', async () => {
  await act(async () => root.render(<Navigation />));
  const favorite = container.querySelector<HTMLAnchorElement>('a[href="/favorites"]')!;
  expect(favorite.textContent).toBe('علاقه‌مندی‌ها');
  expect(container.querySelector('a[href="/pharmacies"]')).toBeNull();
  await act(async () => favorite.click());
  expect(container.querySelector('output')?.textContent).toBe('/login?next=%2Ffavorites');
});
it('opens the existing favorites route directly for an authenticated customer', async () => {
  auth.status = 'authed';
  await act(async () => root.render(<Navigation />));
  await act(async () => container.querySelector<HTMLAnchorElement>('a[href="/favorites"]')!.click());
  expect(container.querySelector('output')?.textContent).toBe('/favorites');
  expect(container.textContent).toContain('محصولات ذخیره‌شده');
});
