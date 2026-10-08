export const passwordHint = 'حداقل ۱۲ نویسه؛ حداکثر ۷۲ بایت (برای حروف فارسی کوتاه‌تر).';
export const usernameHint = '۳ تا ۳۲ حرف انگلیسی، عدد، نقطه یا زیرخط.';

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function usernameError(value: string): string | undefined {
  return /^[a-z0-9_.]{3,32}$/.test(normalizeUsername(value)) ? undefined : usernameHint;
}

export function passwordError(value: string): string | undefined {
  return Array.from(value).length >= 12 && new TextEncoder().encode(value).length <= 72
    ? undefined
    : passwordHint;
}
