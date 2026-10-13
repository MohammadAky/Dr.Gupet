import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

export function AccountFrame({ title, children }: { title: string; children: ReactNode }) {
  return <section className="account-page"><AccountNav /><h1 tabIndex={-1}>{title}</h1>{children}</section>;
}

const sections = [
  ['/profile', 'حساب من'],
  ['/pets', 'حیوانات من'],
  ['/orders', 'سفارش‌ها'],
  ['/addresses', 'آدرس‌ها'],
  ['/favorites', 'علاقه‌مندی‌ها'],
  ['/recommendations', 'پیشنهادها'],
] as const;

/** Shared orientation for account routes; auth remains with the existing route guard. */
export function AccountNav() {
  return (
    <nav className="account-nav" aria-label="بخش‌های حساب کاربری">
      {sections.map(([to, label]) => (
        <NavLink key={to} to={to} end={to === '/profile'}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
