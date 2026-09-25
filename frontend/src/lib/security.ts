/**
 * Validates a redirect destination to prevent Open Redirect attacks.
 * Accepts only internal relative paths starting with a single '/'
 * and rejecting '//' (protocol-relative), whitespace, and protocol handlers.
 */
export function sanitizeInternalRedirect(target: string | null | undefined, fallback = '/'): string {
  if (!target) return fallback;
  const trimmed = target.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  // Disallow control characters or newlines
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}
