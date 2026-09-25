import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-provider';
import { sanitizeInternalRedirect } from '../lib/security';

/** Keeps the intended destination across the login flow (`?next=`). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <p>در حال بارگذاری…</p>;
  if (status === 'guest') {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

/** Authenticated users are bounced away from /login (back to `next` or home). */
export function RequireGuest({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <p>در حال بارگذاری…</p>;
  if (status === 'authed') {
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    const target = sanitizeInternalRedirect(next);
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}
