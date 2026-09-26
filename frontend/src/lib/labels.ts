import { isApiError } from './errors';
import type {
  Gender,
  LifeStage,
  NeuterSuitability,
  OrderStatus,
  PaymentStatus,
  SizeClass,
  TagType,
} from '../api/types';

/** Single source of Persian labels for API enums (convention §5.13). */

export const GENDER_FA: Record<Gender, string> = { MALE: 'نر', FEMALE: 'ماده' };

export const LIFE_STAGE_FA: Record<LifeStage, string> = {
  PUPPY_KITTEN: 'توله/بچه گربه',
  ADULT: 'بالغ',
  SENIOR: 'سالمند',
  ALL: 'همه سنین',
};

export const SIZE_CLASS_FA: Record<SizeClass, string> = {
  SMALL: 'کوچک',
  MEDIUM: 'متوسط',
  LARGE: 'بزرگ',
  ALL: 'همه سایزها',
};

export const NEUTER_FA: Record<NeuterSuitability, string> = {
  ANY: 'همه',
  NEUTERED_ONLY: 'فقط عقیم‌شده',
};

export const TAG_TYPE_FA: Record<TagType, string> = {
  ALLERGEN: 'آلرژن',
  DIET: 'رژیمی',
};

export const ORDER_STATUS_FA: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'در انتظار پرداخت',
  PAID: 'پرداخت شده',
  PROCESSING: 'در حال پردازش',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل شده',
  CANCELED: 'لغو شده',
};

export const PAYMENT_STATUS_FA: Record<PaymentStatus, string> = {
  INITIATED: 'شروع شده',
  SUCCESS: 'موفق',
  FAILED: 'ناموفق',
};

/** Fallback Persian messages by stable English error code (README §6.3). */
export const ERROR_FA: Record<string, string> = {
  VALIDATION_ERROR: 'اطلاعات ارسالی معتبر نیست',
  UNAUTHORIZED: 'برای ادامه وارد حساب خود شوید',
  FORBIDDEN: 'دسترسی مجاز نیست',
  NOT_FOUND: 'مورد درخواستی یافت نشد',
  CONFLICT: 'اطلاعات تکراری است',
  LIMIT_REACHED: 'به حد مجاز رسیده‌اید',
  OTP_INVALID: 'کد واردشده صحیح نیست',
  OTP_EXPIRED: 'کد منقضی شده است، کد جدید بگیرید',
  OTP_RATE_LIMITED: 'تعداد درخواست‌ها زیاد است، کمی صبر کنید',
  USER_BLOCKED: 'حساب کاربری شما مسدود شده است',
  VARIANT_UNAVAILABLE: 'این واریانت موجود نیست',
  OUT_OF_STOCK: 'موجودی کافی نیست',
  CART_EMPTY: 'سبد خرید شما خالی است',
  COUPON_INVALID: 'کد تخفیف معتبر نیست',
  COUPON_EXPIRED: 'کد تخفیف منقضی شده است',
  COUPON_LIMIT_REACHED: 'ظرفیت استفاده از این کد تخفیف تکمیل شده است',
  COUPON_MIN_AMOUNT: 'کد تخفیف برای این مبلغ قابل استفاده نیست',
  ORDER_INVALID_STATE: 'این عملیات برای این سفارش مجاز نیست',
  PAYMENT_FAILED: 'پرداخت ناموفق بود',
  INTERNAL_ERROR: 'خطایی رخ داد، دوباره تلاش کنید',
  NETWORK: 'ارتباط با سرور برقرار نشد',
};

const FALLBACK_MESSAGE = 'خطایی رخ داد، دوباره تلاش کنید';

/** Server Persian message when present, otherwise the code-based fallback. */
export function errorText(error: unknown): string {
  if (typeof error === 'string' && /[\u0600-\u06ff]/.test(error)) return error;
  if (isApiError(error)) {
    if (error.message && error.message !== `HTTP ${error.statusCode}`) return error.message;
    return ERROR_FA[error.code] ?? FALLBACK_MESSAGE;
  }
  if (error instanceof TypeError) return ERROR_FA.NETWORK ?? FALLBACK_MESSAGE;
  if (error instanceof Error && /[\u0600-\u06ff]/.test(error.message)) return error.message;
  return FALLBACK_MESSAGE;
}
