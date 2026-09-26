import { NavLink } from 'react-router-dom';
import type { AuthStatus } from '../../auth/auth-provider';

type NavIconName = 'home' | 'products' | 'cart' | 'account';

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
    cart: (
      <>
        <path d="M3 5h2l2 11h11l3-8H6" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
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

export function MobileBottomNav({
  status,
  cartCount,
  onNavigate,
}: {
  status: AuthStatus;
  cartCount: number;
  onNavigate: () => void;
}) {
  return (
    <nav className="mobile-bottom-nav" aria-label="دسترسی سریع موبایل" onClick={onNavigate}>
      <NavLink to="/" end>
        <NavIcon name="home" />
        <span>خانه</span>
      </NavLink>
      <NavLink to="/products">
        <NavIcon name="products" />
        <span>محصولات</span>
      </NavLink>
      <NavLink to="/cart" aria-label={`سبد خرید، ${cartCount} کالا`}>
        <NavIcon name="cart" />
        <span>سبد خرید</span>
        {cartCount > 0 && (
          <b className="mobile-bottom-nav__count" aria-hidden="true">
            {cartCount > 99 ? '۹۹+' : cartCount.toLocaleString('fa-IR')}
          </b>
        )}
      </NavLink>
      <NavLink to={status === 'authed' ? '/profile' : '/login'}>
        <NavIcon name="account" />
        <span>{status === 'authed' ? 'حساب من' : 'ورود'}</span>
      </NavLink>
    </nav>
  );
}
