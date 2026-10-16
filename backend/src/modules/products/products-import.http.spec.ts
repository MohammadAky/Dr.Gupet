import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { ProductsImportService } from './products-import.service';
import { AuditService } from '../../admin/audit/audit.service';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import type { Request, Response, NextFunction } from 'express';

describe('Product import HTTP validation and ADMIN role (controlled identity)', () => {
  let app: INestApplication;
  let url: string;
  const importer = {
    importBatch: jest
      .fn()
      .mockResolvedValue({ imported: 1, products: [{ id: 1, name: 'خوراک', slug: 'خوراک' }] }),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminProductsController],
      providers: [
        { provide: AdminProductsService, useValue: {} },
        { provide: ProductsImportService, useValue: importer },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = { sub: 7, role: req.headers['x-test-role'] || 'USER' };
      next();
    });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  beforeEach(() => {
    importer.importBatch.mockClear();
    audit.record.mockClear();
  });
  afterAll(async () => app?.close());
  async function post(body: unknown, role = 'ADMIN') {
    return fetch(`${url}/api/v1/admin/products/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-role': role },
      body: JSON.stringify(body),
    });
  }
  const valid = {
    brandId: 1,
    categoryId: 2,
    petTypeId: 3,
    rows: [{ name: 'خوراک', price: 123456 }],
  };
  it('routes the literal import path and preserves numeric Toman contract and admin audit', async () => {
    const response = await post(valid);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ imported: 1 });
    expect(importer.importBatch).toHaveBeenCalledWith(expect.objectContaining(valid));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: 7, action: 'CREATE', entity: 'Product' }),
    );
  });
  it('rejects USER before importing or auditing', async () => {
    expect((await post(valid, 'USER')).status).toBe(403);
    expect(importer.importBatch).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it('accepts optional fallbacks and nested per-row references with normalized Persian names', async () => {
    const response = await post({
      rows: [
        {
          name: 'خوراک سگ',
          price: 10,
          petTypeId: 3,
          brandName: ' برند كيان ',
          categoryName: ' خوراك‌سگ ',
        },
        { name: 'خوراک گربه', price: 20, petTypeId: 4, brandId: 5, categoryId: 6 },
      ],
    });
    expect(response.status).toBe(201);
    expect(importer.importBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [
          expect.objectContaining({
            petTypeId: 3,
            brandName: 'برند کیان',
            categoryName: 'خوراکسگ',
          }),
          expect.objectContaining({ petTypeId: 4, brandId: 5, categoryId: 6 }),
        ],
      }),
    );
  });
  it.each([
    { ...valid, brandId: 0 },
    { ...valid, rows: [{ name: 'خوراک', price: '1e3' }] },
    { ...valid, rows: [{ name: 'خوراک', price: 2147483648 }] },
    { ...valid, rows: [{ name: 'خوراک', price: 1, weightGram: -1 }] },
    { ...valid, rows: [{ name: 'خوراک', price: 1, extra: 'unknown' }] },
    { ...valid, rows: [{ name: 'خوراک', price: 1, brandId: 0 }] },
    { ...valid, rows: [{ name: 'خوراک', price: 1, petTypeId: '3' }] },
    { ...valid, rows: [{ name: 'خوراک', price: 1, brandName: ' ـ‌ ' }] },
    { ...valid, rows: [{ name: 'خوراک', price: 1, categoryName: null }] },
    { ...valid, rows: [{ name: 'خوراک', price: 1, categoryName: 'م'.repeat(192) }] },
  ])('rejects malformed body %# with real nested DTO validation', async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(importer.importBatch).not.toHaveBeenCalled();
  });
});
