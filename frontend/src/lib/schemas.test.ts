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
    it('accepts 5 digits', () => {
      expect(otpCodeSchema.parse('12345')).toBe('12345');
      expect(otpCodeSchema.parse('۱۲۳۴۵')).toBe('12345');
    });

    it('rejects anything not 5 digits', () => {
      expect(otpCodeSchema.safeParse('1234').success).toBe(false);
      expect(otpCodeSchema.safeParse('123456').success).toBe(false);
    });
  });

  describe('addressSchema', () => {
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
