import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response, NextFunction } from 'express';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { ProductsImportService } from './products-import.service';
import { AuditService } from '../../admin/audit/audit.service';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';

describe('Hover-image HTTP body and ADMIN role (controlled identity)', () => {
  let app: INestApplication;
  let url: string;
  const service = {
    setHoverImage: jest.fn().mockResolvedValue({
      hoverImage: '/uploads/chosen.webp',
      images: [
        { id: 1, url: '/uploads/main.webp', sortOrder: 0 },
        { id: 2, url: '/uploads/chosen.webp', sortOrder: 1 },
      ],
    }),
  };
  const audit = { record: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminProductsController],
      providers: [
        { provide: AdminProductsService, useValue: service },
        { provide: ProductsImportService, useValue: {} },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = { sub: 7, role: req.headers['x-test-role'] || 'USER' };
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  beforeEach(() => {
    service.setHoverImage.mockClear();
    audit.record.mockClear();
  });
  afterAll(async () => app?.close());
  async function patch(body: unknown, role = 'ADMIN') {
    return fetch(url + '/admin/products/1/hover-image', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-test-role': role },
      body: JSON.stringify(body),
    });
  }
  it('passes typed IDs and records selected image in admin audit', async () => {
    const response = await patch({ imageId: 2 });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ hoverImage: '/uploads/chosen.webp' });
    expect(service.setHoverImage).toHaveBeenCalledWith(1, 2);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entityId: 1, adminId: 7 }));
  });
  it('rejects USER before any image write', async () => {
    expect((await patch({ imageId: 2 }, 'USER')).status).toBe(403);
    expect(service.setHoverImage).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5, '2', null, 2147483648])('rejects invalid image ID %j', async (imageId) => {
    expect((await patch({ imageId })).status).toBe(400);
    expect(service.setHoverImage).not.toHaveBeenCalled();
  });
});
