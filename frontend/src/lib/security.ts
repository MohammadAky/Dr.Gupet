/** Accept only an internal route as the destination after authentication. */
export function sanitizeInternalRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  // Browsers can interpret backslashes or control characters as URL separators.
  if (
    value.includes('\\') ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return '/';

  try {
    const base = 'https://drgupet.invalid';
    const target = new URL(value, base);
    if (target.origin !== base) return '/';
    // An authenticated user should not bounce back into the login flow.
    if (target.pathname === '/login' || target.pathname === '/verify') return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/';
  }
}

/** The current backend returns either its local mock endpoint or Zarinpal StartPay. */
export function safePaymentUrl(
  value: string,
  apiBaseUrl: string,
  allowLocalMock: boolean,
): string | null {
  try {
    const target = new URL(value);
    if (target.username || target.password) return null;

    const zarinpalHost =
      target.hostname === 'www.zarinpal.com' || target.hostname === 'sandbox.zarinpal.com';
    if (
      target.protocol === 'https:' &&
      zarinpalHost &&
      target.port === '' &&
      /^\/pg\/StartPay\/[^/]+$/.test(target.pathname)
    ) {
      return target.href;
    }

    const api = new URL(apiBaseUrl);
    const mockPath = `${api.pathname.replace(/\/+$/, '')}/payments/mock-pay`;
    if (
      allowLocalMock &&
      target.protocol === 'http:' &&
      target.origin === api.origin &&
      target.hostname === 'localhost' &&
      target.pathname === mockPath
    ) {
      return target.href;
    }
    return null;
  } catch {
    return null;
  }
}
