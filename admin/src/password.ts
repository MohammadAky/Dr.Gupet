export const usernameHint = "۳ تا ۳۲ حرف انگلیسی، عدد، نقطه یا زیرخط.";
export const passwordHint = "حداقل ۱۲ نویسه؛ حداکثر ۷۲ بایت (برای حروف فارسی کوتاه‌تر).";
export const normalizeUsername = (value: string) => value.trim().toLowerCase();
export const normalizePhone = (value: string) => value
  .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
  .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
  .replace(/[\s-]/g, "");
export function credentialError(username: string, password: string, confirm?: string): string {
  if (!/^[a-z0-9_.]{3,32}$/.test(normalizeUsername(username))) return usernameHint;
  if (Array.from(password).length < 12 || new TextEncoder().encode(password).length > 72) return passwordHint;
  if (confirm !== undefined && password !== confirm) return "تکرار رمز عبور یکسان نیست.";
  return "";
}
export function credentialFieldErrors(username: string, password: string, confirm: string, prefix: "assign" | "create") {
  const errors: Record<string, string> = {};
  if (!/^[a-z0-9_.]{3,32}$/.test(normalizeUsername(username))) errors.username = usernameHint;
  if (Array.from(password).length < 12 || new TextEncoder().encode(password).length > 72) errors[`${prefix}-password`] = passwordHint;
  if (password !== confirm) errors[`${prefix}-confirm`] = "تکرار رمز عبور یکسان نیست.";
  return errors;
}
