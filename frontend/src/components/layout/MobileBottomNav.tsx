import { NavLink } from 'react-router-dom';
import type { AuthStatus } from '../../auth/auth-provider';

type NavIconName = 'home' | 'products' | 'pharmacies' | 'account';

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
    pharmacies: (
      <>
        <path d="M4 7h16v14H4zM3 7l2-4h14l2 4" />
        <path d="M10 12h4m-2-2v4M7 21v-4h10v4" />
      </>
    ),
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
      <NavLink to="/pharmacies">
        <NavIcon name="pharmacies" />
        <span>داروخانه‌ها</span>
      </NavLink>
      <NavLink to={status === 'authed' ? '/profile' : '/login'}>
        <NavIcon name="account" />
        <span>{status === 'authed' ? 'حساب من' : 'ورود'}</span>
      </NavLink>
    </nav>
  );
}
