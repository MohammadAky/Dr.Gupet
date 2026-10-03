/** Accept only an internal route as the destination after authentication. */
export function sanitizeInternalRedirect(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  // Browsers can interpret backslashes or control characters as URL separators.
  if (
    value.includes('\\') ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return fallback;

  try {
    const base = 'https://drgupet.invalid';
    const target = new URL(value, base);
    if (target.origin !== base) return fallback;
    // An authenticated user should not bounce back into the login flow.
    if (target.pathname === '/login' || target.pathname === '/verify') return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

/** Only the live gateway URL may receive the browser after order creation. */
export function safePaymentUrl(value: string): string | null {
  try {
    const target = new URL(value);
    if (target.username || target.password) return null;

    if (
      target.protocol === 'https:' &&
      target.hostname === 'www.zarinpal.com' &&
      target.port === '' &&
      /^\/pg\/StartPay\/[^/]+$/.test(target.pathname)
    ) {
      return target.href;
    }

    return null;
  } catch {
    return null;
  }
}
