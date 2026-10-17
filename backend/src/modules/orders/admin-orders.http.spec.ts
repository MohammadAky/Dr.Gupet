import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AuditService } from '../../admin/audit/audit.service';
import type { Request, Response, NextFunction } from 'express';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Admin order HTTP validation (controlled identity, no database)', () => {
  let app: INestApplication;
  const orders = { transition: jest.fn(), cancel: jest.fn() };
  const audit = { record: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminOrdersController],
      providers: [
        { provide: AdminOrdersService, useValue: orders },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = { sub: 7, role: req.headers['x-test-role'] || 'USER' };
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    orders.transition.mockResolvedValue({ status: 'DELIVERED' });
    orders.cancel.mockResolvedValue({ status: 'CANCELED' });
  });
  it.each([
    { to: 'PAID' },
    { to: 'PENDING_PAYMENT' },
    { to: 'CANCELED' },
    { to: 'REFUNDED' },
    { to: 'DELIVERED', expectedStatus: 'UNKNOWN' },
    { to: 'DELIVERED', expectedStatus: null },
    { to: 'DELIVERED', expectedStatus: 1 },
    { to: 'DELIVERED', isPaid: true },
  ])('rejects protected/malformed transition fields %# before service/audit', async (body) => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/admin/orders/1/transition')
      .set('x-test-role', 'ADMIN')
      .send(body);
    expect(response.status).toBe(400);
    expect(orders.transition).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it('forwards the direct target and expected status through the audited route', async () => {
    const body = { to: 'DELIVERED', expectedStatus: 'PAID' };
    const response = await request(app.getHttpServer())
      .patch('/api/v1/admin/orders/1/transition')
      .set('x-test-role', 'ADMIN')
      .send(body);
    expect(response.status).toBe(200);
    expect(orders.transition).toHaveBeenCalledWith(1, expect.objectContaining(body));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 7,
        action: 'STATUS_CHANGE',
        entity: 'Order',
        entityId: 1,
        summary: '→ DELIVERED',
      }),
    );
  });
  it('passes expected status to dedicated cancellation and rejects invalid/null expectations', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/orders/1/cancel')
      .set('x-test-role', 'ADMIN')
      .send({ reason: 'درخواست مشتری', expectedStatus: 'PENDING_PAYMENT' });
    expect(response.status).toBe(201);
    expect(orders.cancel).toHaveBeenCalledWith(1, 'درخواست مشتری', 'PENDING_PAYMENT');
    orders.cancel.mockClear();
    for (const expectedStatus of [null, 'UNKNOWN'])
      expect(
        (
          await request(app.getHttpServer())
            .post('/api/v1/admin/orders/1/cancel')
            .set('x-test-role', 'ADMIN')
            .send({ expectedStatus })
        ).status,
      ).toBe(400);
    expect(orders.cancel).not.toHaveBeenCalled();
  });
  it('rejects USER before changing status or auditing', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/admin/orders/1/transition')
      .set('x-test-role', 'USER')
      .send({ to: 'DELIVERED' });
    expect(response.status).toBe(403);
    expect(orders.transition).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
