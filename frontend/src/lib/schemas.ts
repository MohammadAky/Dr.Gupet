import { z } from 'zod';
import { normalizeOtpCode, normalizePhone } from './phone';
import { todayIso } from './jalali';
import { MAX_CART_ITEM_QTY, UPLOAD_MAX_MB } from './constants';

/** Zod schemas mirror the backend DTO rules (class-validator) with Persian messages. */

export const phoneSchema = z
  .string()
  .min(1, 'شماره موبایل را وارد کنید')
  .transform((value) => normalizePhone(value))
  .refine((value): value is string => value !== null, 'شماره موبایل معتبر نیست');

export const otpCodeSchema = z
  .string()
  .transform((value) => normalizeOtpCode(value))
  .refine((value): value is string => value !== null, 'کد ۵ رقمی را وارد کنید');

export const profileSchema = z.object({
  firstName: z.string().max(50, 'حداکثر ۵۰ کاراکتر').nullable(),
  lastName: z.string().max(50, 'حداکثر ۵۰ کاراکتر').nullable(),
  avatar: z.string().nullable().optional(),
});

export const addressSchema = z.object({
  title: z.string().min(1, 'عنوان آدرس را وارد کنید').max(50, 'حداکثر ۵۰ کاراکتر'),
  receiverName: z.string().min(1, 'نام گیرنده را وارد کنید').max(100, 'حداکثر ۱۰۰ کاراکتر'),
  receiverPhone: phoneSchema,
  province: z.string().min(1, 'استان را وارد کنید').max(50),
  city: z.string().min(1, 'شهر را وارد کنید').max(50),
  fullAddress: z.string().min(1, 'نشانی کامل را وارد کنید').max(500, 'حداکثر ۵۰۰ کاراکتر'),
  postalCode: z
    .string()
    .regex(/^\d{0,10}$/, 'کد پستی فقط رقم و حداکثر ۱۰ رقم است')
    .optional()
    .or(z.literal('')),
});

export type AddressFormValues = z.input<typeof addressSchema>;

export const petSchema = z.object({
  name: z.string().min(1, 'نام حیوان را وارد کنید').max(50, 'حداکثر ۵۰ کاراکتر'),
  petTypeId: z.number().min(1, 'نوع حیوان را انتخاب کنید'),
  breedId: z.number().min(1).nullable().optional(),
  birthDate: z
    .string()
    .refine(
      (value) => value === '' || (Number.isFinite(Date.parse(value)) && value <= todayIso()),
      'تاریخ تولد نمی‌تواند در آینده باشد',
    )
    .optional(),
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  isNeutered: z.boolean().optional(),
  weightKg: z
    .number()
    .min(0.1, 'وزن باید بین ۰.۱ تا ۲۰۰ کیلوگرم باشد')
    .max(200, 'وزن باید بین ۰.۱ تا ۲۰۰ کیلوگرم باشد')
    .nullable()
    .optional(),
  photo: z.string().nullable().optional(),
});

export type PetFormValues = z.input<typeof petSchema>;

export const quantitySchema = z
  .number()
  .min(1, 'حداقل تعداد ۱ است')
  .max(MAX_CART_ITEM_QTY, `حداکثر تعداد ${MAX_CART_ITEM_QTY} است`);

/** Client-side pre-check mirroring UploadService (magic bytes are checked server-side). */
export function validateUploadFile(file: File): string | null {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return 'فقط فایل‌های JPEG، PNG و WebP مجاز هستند';
  if (file.size > UPLOAD_MAX_MB * 1024 * 1024)
    return `حجم فایل نباید بیش از ${UPLOAD_MAX_MB} مگابایت باشد`;
  return null;
}
