/**
 * Session storage for the refresh token (decision FR-DEC-05):
 * access token lives in memory only; refresh token is persisted so a reload
 * can restore the session. The refresh token itself is opaque to us — it is
 * validated and rotated server-side (Redis), never decoded in the browser.
 */

const KEY = 'drgupet.refreshToken';

function available(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export const tokenStorage = {
  get(): string | null {
    if (!available()) return null;
    return window.localStorage.getItem(KEY);
  },
  set(token: string): void {
    if (!available()) return;
    window.localStorage.setItem(KEY, token);
  },
  clear(): void {
    if (!available()) return;
    window.localStorage.removeItem(KEY);
  },
};
