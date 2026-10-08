import { AppException } from '../../common/filters/all-exceptions.filter';

export const PASSWORD_BCRYPT_COST = 12;
export const USERNAME_PATTERN = /^[a-z0-9_.]{3,32}$/;

export function normalizeUsername(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export function canonicalUsername(value: string): string {
  const username = normalizeUsername(value);
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    throw new AppException(
      'VALIDATION_ERROR',
      'نام کاربری باید ۳ تا ۳۲ حرف انگلیسی، رقم، نقطه یا زیرخط باشد',
      400,
    );
  }
  return username;
}

export function validPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    [...value].length >= 12 &&
    Buffer.byteLength(value, 'utf8') <= 72 &&
    !value.includes('\0')
  );
}

export function assertPassword(value: string): void {
  if (!validPassword(value)) {
    throw new AppException(
      'VALIDATION_ERROR',
      'رمز عبور باید حداقل ۱۲ کاراکتر و حداکثر ۷۲ بایت باشد',
      400,
    );
  }
}
