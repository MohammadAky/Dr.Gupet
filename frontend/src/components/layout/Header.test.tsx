// @vitest-environment jsdom
import { act, useState, type FormEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

function Harness() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  return (
    <Header
      status="guest"
      userName={null}
      cartCount={0}
      search={search}
      menuOpen={menuOpen}
      onSearchChange={setSearch}
      onSearchSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}
      onMenuToggle={() => setMenuOpen((open) => !open)}
      onMenuClose={() => setMenuOpen(false)}
      onLogout={() => {}}
    />
  );
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
});
