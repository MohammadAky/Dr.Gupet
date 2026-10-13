import { useQuery } from '@tanstack/react-query';
import { Suspense, type FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { shopApi } from './api/endpoints-shop';
import { queryKeys } from './api/query-keys';
import { useAuth } from './auth/auth-provider';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { ThemeToggle } from './components/layout/ThemeToggle';
import { ConsentBanner } from './privacy/ConsentBanner';
import { PageMetadata } from './components/PageMetadata';
import { RouteBoundary } from './components/RouteBoundary';
import { LoadingState } from './components/states';
import { landingSample, safeLandingLink } from './features/landing/content';

export function Shell() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  const scrollPositions = useRef(new Map<string, number>());
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useLayoutEffect(() => {
    const changed = previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    if (changed && !location.hash) {
      window.scrollTo({
        top: navigationType === 'POP' ? (scrollPositions.current.get(location.pathname) ?? 0) : 0,
        behavior: 'instant',
      });
      mainRef.current?.focus({ preventScroll: true });
    }
    const path = location.pathname;
    const positions = scrollPositions.current;
    return () => {
      positions.set(path, window.scrollY);
    };
  }, [location.pathname, location.hash, navigationType]);

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
    const revocation = logout();
    navigate('/');
    await revocation;
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMenuOpen(false);
    const query = search.trim();
    navigate(query ? `/products?q=${encodeURIComponent(query)}` : '/products');
  }

  return (
    <div
      className="app-shell"
      onKeyDownCapture={(event) => {
        event.currentTarget.dataset.routeMotion = 'instant';
      }}
      onPointerDownCapture={(event) => {
        event.currentTarget.dataset.routeMotion = 'enter';
      }}
      onClickCapture={(event) => {
        // Keyboard and assistive-tech activations have no pointer click count.
        if (event.detail === 0) event.currentTarget.dataset.routeMotion = 'instant';
      }}
    >
      <PageMetadata />
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>
      {(location.pathname !== '/' || landingSample.announcement.enabled) && (
        <div className="announcement">
          {location.pathname === '/' ? (
            landingSample.announcement.href && safeLandingLink(landingSample.announcement.href) ? (
              <a href={landingSample.announcement.href}>{landingSample.announcement.text}</a>
            ) : (
              landingSample.announcement.text
            )
          ) : (
            'دکتر گوپت، همراه شما برای انتخاب آگاهانهٔ محصولات حیوانات خانگی'
          )}
        </div>
      )}
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
        ref={mainRef}
        tabIndex={-1}
        key={location.pathname}
        id="main-content"
        className={`app-main${location.pathname === '/' ? '' : ' content-page'}`}
      >
        <RouteBoundary key={location.pathname}>
          <Suspense fallback={<LoadingState text="در حال آماده‌سازی صفحه…" />}>
            <Outlet />
          </Suspense>
        </RouteBoundary>
      </main>
      <Footer />
      <MobileBottomNav status={status} />
      <ThemeToggle />
      <ConsentBanner />
    </div>
  );
}
