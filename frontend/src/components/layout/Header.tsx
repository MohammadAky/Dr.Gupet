import type { FormEvent } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { AuthStatus } from '../../auth/auth-provider';

interface HeaderProps {
  status: AuthStatus;
  userName: string | null;
  cartCount: number;
  search: string;
  menuOpen: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onLogout: () => void;
}

function Icon({ name }: { name: 'search' | 'cart' | 'user' | 'menu' }) {
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 5 5" />
      </>
    ),
    cart: (
      <>
        <path d="M3 5h2l2 11h11l3-8H6" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
  };
  return (
    <svg
      width="19"
      height="19"
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

export function Header({
  status,
  userName,
  cartCount,
  search,
  menuOpen,
  onSearchChange,
  onSearchSubmit,
  onMenuToggle,
  onMenuClose,
  onLogout,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-main site-container">
        <div className="header-brand">
          <button
            type="button"
            className="mobile-toggle"
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            aria-label={menuOpen ? 'بستن فهرست' : 'باز کردن فهرست'}
            onClick={onMenuToggle}
          >
            <Icon name="menu" />
          </button>
          <Link
            to="/"
            className="app-logo"
            aria-label="دکتر گوپت، صفحهٔ اصلی"
            onClick={onMenuClose}
          >
            <img src="/brand/logo.jpg" alt="" width="55" height="55" />
            <span>
              دکتر گوپت<small>DR. GUPET</small>
            </span>
          </Link>
        </div>
        <form className="header-search" role="search" onSubmit={onSearchSubmit}>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="جستجوی محصولات"
            placeholder="جستجوی محصول، برند و ..."
          />
          <button type="submit" aria-label="جستجو">
            <Icon name="search" />
          </button>
        </form>
        <div className="header-actions">
          {status === 'authed' ? (
            <>
              <Link to="/profile" aria-label={userName ? `${userName}، حساب من` : 'حساب من'}>
                <Icon name="user" />
                <span className="header-label">{userName ?? 'حساب من'}</span>
              </Link>
              <button className="logout-button" type="button" onClick={onLogout}>
                خروج
              </button>
            </>
          ) : (
            <Link to="/login" aria-label="ورود">
              <Icon name="user" />
              <span className="header-label">ورود</span>
            </Link>
          )}
          <Link to="/cart" className="cart-link" aria-label={`سبد خرید، ${cartCount} کالا`}>
            <Icon name="cart" />
            <span className="header-label">سبد خرید</span>
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </Link>
        </div>
      </div>
      <nav
        id="main-navigation"
        className={`app-nav${menuOpen ? ' is-open' : ''}`}
        aria-label="ناوبری اصلی"
      >
        <div className="app-nav__inner site-container" onClick={onMenuClose}>
          <NavLink to="/" end>
            صفحهٔ اصلی
          </NavLink>
          <NavLink to="/products">محصولات</NavLink>
          <NavLink to="/medicines">اطلاعات داروها</NavLink>
          <NavLink to="/pharmacies">داروخانه‌ها</NavLink>
          {status === 'authed' && <NavLink to="/recommendations">پیشنهادهای من</NavLink>}
          {status === 'authed' && <NavLink to="/favorites">علاقه‌مندی‌ها</NavLink>}
          {status === 'authed' && <NavLink to="/orders">سفارش‌ها</NavLink>}
          {status === 'authed' && (
            <button className="mobile-logout" type="button" onClick={onLogout}>
              خروج از حساب
            </button>
          )}
        </div>
        <form className="mobile-search site-container" role="search" onSubmit={onSearchSubmit}>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="جستجوی محصولات در موبایل"
            placeholder="جستجوی محصول یا برند"
          />
          <button type="submit">جستجو</button>
        </form>
      </nav>
    </header>
  );
}
