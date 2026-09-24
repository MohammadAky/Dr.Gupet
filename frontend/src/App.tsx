import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { shopApi } from './api/endpoints-shop';
import { queryKeys } from './api/query-keys';
import { useAuth } from './auth/auth-provider';

/**
 * Application shell. No visual design here — the styling layer owns markup
 * classes; this component only exposes structure and behaviour (nav state,
 * cart badge, session menu).
 */
export function Shell() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();

  const cart = useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => shopApi.cart(),
    enabled: status === 'authed',
  });

  const cartCount = cart.data?.items.length ?? 0;

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-logo">
          دکتر گوپت
        </Link>
        <nav className="app-nav" aria-label="ناوبری اصلی">
          <NavLink to="/products">محصولات</NavLink>
          <NavLink to="/medicines">دارو‌ها</NavLink>
          <NavLink to="/pharmacies">داروخانه‌ها</NavLink>
          {status === 'authed' && <NavLink to="/recommendations">پیشنهادها</NavLink>}
          {status === 'authed' && <NavLink to="/favorites">علاقه‌مندی‌ها</NavLink>}
          {status === 'authed' && <NavLink to="/orders">سفارش‌ها</NavLink>}
          <NavLink to="/cart" className="cart-link">
            سبد خرید{cartCount > 0 ? ` (${cartCount})` : ''}
          </NavLink>
        </nav>
        <div className="app-session">
          {status === 'authed' ? (
            <>
              <Link to="/profile">{user?.firstName ?? user?.phone ?? 'حساب من'}</Link>
              <button type="button" onClick={() => void handleLogout()}>
                خروج
              </button>
            </>
          ) : (
            <Link to="/login">ورود</Link>
          )}
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <p>فروشگاه غذای خشک سگ و گربه — اطلاعات دارویی صرفاً جهت آگاهی است.</p>
      </footer>
    </div>
  );
}
