/**
 * Normalize Iranian phone number to 09XXXXXXXXX format
 * Accepts: Persian/Arabic digits, +98, 0098, 98 prefixes, spaces/dashes
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null;

  // Persian/Arabic digits to Latin
  let normalized = input
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632));

  // Remove spaces, dashes, parentheses, plus
  normalized = normalized.replace(/[\s\-\(\)\+]/g, '');

  // Handle various prefixes
  if (normalized.startsWith('0098')) {
    normalized = '0' + normalized.slice(4);
  } else if (normalized.startsWith('98')) {
    normalized = '0' + normalized.slice(2);
  }

  // Validate final format: 09XXXXXXXXX (11 digits)
  if (!/^09\d{9}$/.test(normalized)) {
    return null;
  }

  return normalized;
}