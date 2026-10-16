export const usernameHint = '۳ تا ۳۲ حرف انگلیسی، عدد، نقطه یا زیرخط.';

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function usernameError(value: string): string | undefined {
  return /^[a-z0-9_.]{3,32}$/.test(normalizeUsername(value)) ? undefined : usernameHint;
}

export function passwordError(value: string): string | undefined {
  if (Array.from(value).length < 8) return 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  if (new TextEncoder().encode(value).length > 72) return 'رمز عبور طولانی است؛ کوتاه‌ترش کنید.';
  return undefined;
}
