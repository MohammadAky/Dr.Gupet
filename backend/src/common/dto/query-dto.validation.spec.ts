import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ClinicQueryDto } from '../../modules/clinics/dto/clinic-query.dto';
import { PharmacyQueryDto } from '../../modules/pharmacies/dto/pharmacy-query.dto';
import { ProductQueryDto } from '../../modules/products/dto/product-query.dto';
import { OrderQueryDto } from '../../modules/orders/dto/order-query.dto';
import { PaginationQueryDto } from './pagination-query.dto';

// Mirrors the global pipe configuration from src/main.ts
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const QUERY_META = { type: 'query' } as any;

async function validate(metatype: any, value: any) {
  return pipe.transform(value, { ...QUERY_META, metatype });
}

describe('Query DTO validation (issue #5)', () => {
  describe('ClinicQueryDto', () => {
    it('accepts explicit is24h=true/false and transforms to boolean', async () => {
      const result = await validate(ClinicQueryDto, { is24h: 'true' });
      expect(result.is24h).toBe(true);
      const result2 = await validate(ClinicQueryDto, { is24h: 'false' });
      expect(result2.is24h).toBe(false);
    });

    it('rejects is24h=banana with 400', async () => {
      await expect(validate(ClinicQueryDto, { is24h: 'banana' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects q longer than 100 chars', async () => {
      await expect(validate(ClinicQueryDto, { q: 'x'.repeat(101) })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects non-numeric page and out-of-range limit', async () => {
      await expect(validate(ClinicQueryDto, { page: 'abc' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(validate(ClinicQueryDto, { limit: '1000' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects unknown keys (forbidNonWhitelisted) instead of passing them to the query', async () => {
      await expect(
        validate(ClinicQueryDto, { city: 'تهران', evil: 'drop-me' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('PharmacyQueryDto', () => {
    it('rejects is24h=banana and long q (parity with clinics)', async () => {
      await expect(validate(PharmacyQueryDto, { is24h: 'banana' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(validate(PharmacyQueryDto, { q: 'x'.repeat(101) })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepts onDuty=true', async () => {
      const result = await validate(PharmacyQueryDto, { onDuty: 'true' });
      expect(result.onDuty).toBe(true);
    });
  });

  describe('ProductQueryDto', () => {
    it('accepts explicit inStock=true/false and transforms to boolean', async () => {
      expect((await validate(ProductQueryDto, { inStock: 'false' })).inStock).toBe(false);
      expect((await validate(ProductQueryDto, { inStock: 'true' })).inStock).toBe(true);
    });

    it('rejects invalid inStock, sort, page and limit', async () => {
      await expect(validate(ProductQueryDto, { inStock: 'maybe' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(validate(ProductQueryDto, { sort: 'bogus' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(validate(ProductQueryDto, { page: '0' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(validate(ProductQueryDto, { limit: '500' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects q longer than 100 chars', async () => {
      await expect(validate(ProductQueryDto, { q: 'x'.repeat(101) })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('OrderQueryDto', () => {
    it('accepts known statuses only', async () => {
      const result = await validate(OrderQueryDto, { status: 'PAID' });
      expect(result.status).toBe('PAID');
      await expect(validate(OrderQueryDto, { status: 'NOT_A_STATUS' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('PaginationQueryDto', () => {
    it('enforces page >= 1 and 1 <= limit <= 50', async () => {
      await expect(validate(PaginationQueryDto, { page: '0' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(validate(PaginationQueryDto, { limit: '51' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      const ok = await validate(PaginationQueryDto, { page: '2', limit: '50' });
      expect(ok.page).toBe(2);
      expect(ok.limit).toBe(50);
    });
  });
});
