import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { shopApi } from './api/endpoints-shop';
import { queryKeys } from './api/query-keys';
import { useAuth } from './auth/auth-provider';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { ThemeToggle } from './components/layout/ThemeToggle';
import { ConsentBanner } from './privacy/ConsentBanner';

export function Shell() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMenuOpen(false));
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [menuOpen]);

  const cart = useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => shopApi.cart(),
    enabled: status === 'authed',
  });
  const cartCount = status === 'authed' ? (cart.data?.items.length ?? 0) : 0;

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMenuOpen(false);
    const query = search.trim();
    navigate(query ? `/products?q=${encodeURIComponent(query)}` : '/products');
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>
      <div className="announcement">
        دکتر گوپت، همراه شما برای انتخاب آگاهانهٔ محصولات حیوانات خانگی
      </div>
      <Header
        status={status}
        userName={user?.firstName ?? null}
        cartCount={cartCount}
        search={search}
        menuOpen={menuOpen}
        onSearchChange={setSearch}
        onSearchSubmit={submitSearch}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onMenuClose={() => setMenuOpen(false)}
        onLogout={() => void handleLogout()}
      />
      <main
        key={location.pathname}
        id="main-content"
        className={`app-main${location.pathname === '/' ? '' : ' content-page'}`}
      >
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav status={status} />
      <ThemeToggle />
      <ConsentBanner />
    </div>
  );
}
