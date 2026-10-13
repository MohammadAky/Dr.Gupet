import { describe, expect, it } from 'vitest';
import { addressSchema, otpCodeSchema, petSchema, phoneSchema } from './schemas';

describe('schemas', () => {
  describe('phoneSchema', () => {
    it('accepts and normalizes valid phone numbers', () => {
      expect(phoneSchema.parse('09123456789')).toBe('09123456789');
      expect(phoneSchema.parse('+989123456789')).toBe('09123456789');
      expect(phoneSchema.parse('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    });

    it('rejects invalid numbers with a Persian message', () => {
      const res = phoneSchema.safeParse('08123456789');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toContain('شماره موبایل');
      }
    });
  });

  describe('otpCodeSchema', () => {
    it('accepts 5 or 6 digits', () => {
      expect(otpCodeSchema.parse('12345')).toBe('12345');
      expect(otpCodeSchema.parse('۱۲۳۴۵')).toBe('12345');
      expect(otpCodeSchema.parse('123456')).toBe('123456');
      expect(otpCodeSchema.parse('۱۲۳۴۵۶')).toBe('123456');
    });

    it('rejects invalid code lengths and embedded nondigits', () => {
      expect(otpCodeSchema.safeParse('1234').success).toBe(false);
      expect(otpCodeSchema.safeParse('1234567').success).toBe(false);
      expect(otpCodeSchema.safeParse('12a345').success).toBe(false);
    });
  });

  describe('addressSchema', () => {
    const validAddress = {
      title: 'خانه',
      receiverName: 'سارا',
      receiverPhone: '09123456789',
      province: 'خراسان رضوی',
      city: 'مشهد',
      fullAddress: 'خیابان نمونه پلاک ۱',
      postalCode: '',
    };
    it('rejects all-whitespace required address text and trims valid surrounding spaces', () => {
      for (const field of ['title', 'receiverName', 'province', 'city', 'fullAddress']) {
        expect(addressSchema.safeParse({ ...validAddress, [field]: '   ' }).success).toBe(false);
      }
      const normalized = addressSchema.parse({
        ...validAddress,
        title: '  خانه  ',
        city: ' مشهد ',
        fullAddress: ' خیابان نمونه پلاک ۱ ',
      });
      expect(normalized).toMatchObject({
        title: 'خانه',
        city: 'مشهد',
        fullAddress: 'خیابان نمونه پلاک ۱',
      });
    });
    it('uses Persian messages for province and city length errors', () => {
      const result = addressSchema.safeParse({
        ...validAddress,
        province: 'الف'.repeat(51),
        city: 'ب'.repeat(51),
      });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues.map((issue) => issue.message)).toEqual([
          'استان باید حداکثر ۵۰ کاراکتر باشد',
          'شهر باید حداکثر ۵۰ کاراکتر باشد',
        ]);
    });
    it('validates a complete address', () => {
      const res = addressSchema.safeParse({
        title: 'خانه',
        receiverName: 'علی رضایی',
        receiverPhone: '09123456789',
        province: 'تهران',
        city: 'تهران',
        fullAddress: 'خیابان آزادی پلاک ۱',
        postalCode: '1234567890',
      });
      expect(res.success).toBe(true);
    });

    it('fails when required fields are missing', () => {
      const res = addressSchema.safeParse({ title: '' });
      expect(res.success).toBe(false);
    });
  });

  describe('petSchema', () => {
    it('accepts valid pet input', () => {
      const res = petSchema.safeParse({
        name: 'میلو',
        petTypeId: 1,
        weightKg: 5.5,
        isNeutered: false,
      });
      expect(res.success).toBe(true);
    });

    it('rejects weight out of range [0.1, 200]', () => {
      expect(petSchema.safeParse({ name: 'x', petTypeId: 1, weightKg: 0 }).success).toBe(false);
      expect(petSchema.safeParse({ name: 'x', petTypeId: 1, weightKg: 201 }).success).toBe(false);
    });

    it('rejects future birth date', () => {
      const res = petSchema.safeParse({
        name: 'x',
        petTypeId: 1,
        birthDate: '2099-01-01',
      });
      expect(res.success).toBe(false);
    });
  });
});
