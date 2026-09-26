/** Limit API-provided images to the app, its API host, or local blob previews. */
export function safeImageUrl(value: unknown, appOrigin: string, apiBaseUrl: string): string | null {
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\\') ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return null;
  if (!value.startsWith('/') && !/^https?:\/\//i.test(value) && !value.startsWith('blob:'))
    return null;

  try {
    const app = new URL(appOrigin);
    const api = new URL(apiBaseUrl);
    if (!['http:', 'https:'].includes(app.protocol) || !['http:', 'https:'].includes(api.protocol))
      return null;

    // An upload path belongs to the backend host, not the SPA's current route.
    const base = value.startsWith('/uploads/') ? api.origin : app.origin;
    const url = new URL(value, base);
    if (url.username || url.password) return null;

    if (url.protocol === 'blob:') {
      return url.origin === app.origin ? url.href : null;
    }
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.origin !== app.origin && url.origin !== api.origin) return null;
    return url.href;
  } catch {
    return null;
  }
}
