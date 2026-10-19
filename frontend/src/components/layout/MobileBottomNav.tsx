import { NavLink, useLocation } from 'react-router-dom';
import { sanitizeInternalRedirect } from '../../lib/security';
import type { AuthStatus } from '../../auth/auth-provider';

type NavIconName = 'home' | 'products' | 'favorites' | 'account';

function NavIcon({ name }: { name: NavIconName }) {
  const paths = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" />
        <path d="M9 21v-7h6v7" />
      </>
    ),
    products: (
      <>
        <rect x="3" y="4" width="8" height="8" rx="1" />
        <rect x="13" y="4" width="8" height="8" rx="1" />
        <rect x="3" y="14" width="8" height="7" rx="1" />
        <rect x="13" y="14" width="8" height="7" rx="1" />
      </>
    ),
    favorites: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    account: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  };
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function MobileBottomNav({ status }: { status: AuthStatus }) {
  const location = useLocation();
  const loginHref = `/login?${new URLSearchParams({ next: sanitizeInternalRedirect(location.pathname + location.search + location.hash) })}`;
  return (
    <nav className="mobile-bottom-nav" aria-label="دسترسی سریع موبایل">
      <NavLink to="/" end>
        <NavIcon name="home" />
        <span>خانه</span>
      </NavLink>
      <NavLink to="/products">
        <NavIcon name="products" />
        <span>محصولات</span>
      </NavLink>
      <NavLink to="/favorites">
        <NavIcon name="favorites" />
        <span>علاقه‌مندی‌ها</span>
      </NavLink>
      <NavLink to={status === 'authed' ? '/profile' : loginHref}>
        <NavIcon name="account" />
        <span>{status === 'authed' ? 'حساب من' : 'ورود'}</span>
      </NavLink>
    </nav>
  );
}
