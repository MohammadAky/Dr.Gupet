import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response, NextFunction } from 'express';
import { AdminProductsController } from '../modules/products/admin-products.controller';
import { AdminProductsService } from '../modules/products/admin-products.service';
import { ProductsImportService } from '../modules/products/products-import.service';
import { AdminUsersController } from '../modules/users/admin-users.controller';
import { UsersService } from '../modules/users/users.service';
import { PasswordService } from '../modules/auth/password.service';
import { AdminOrdersController } from '../modules/orders/admin-orders.controller';
import { AdminOrdersService } from '../modules/orders/admin-orders.service';
import { AdminPaymentsController } from '../modules/payments/admin-payments.controller';
import { AdminPaymentsService } from '../modules/payments/admin-payments.service';
import { AdminCouponsController } from '../modules/coupons/admin-coupons.controller';
import { AdminCouponsService } from '../modules/coupons/admin-coupons.service';
import { AdminMedicinesController } from '../modules/medicines/admin-medicines.controller';
import { MedicinesService } from '../modules/medicines/medicines.service';
import { AdminPharmaciesController } from '../modules/pharmacies/admin-pharmacies.controller';
import { PharmaciesService } from '../modules/pharmacies/pharmacies.service';
import { AdminClinicsController } from '../modules/clinics/admin-clinics.controller';
import { ClinicsService } from '../modules/clinics/clinics.service';
import { AuditController } from './audit/audit.controller';
import { AuditService } from './audit/audit.service';
import { AdminSmsLogsController } from '../sms/admin-sms-logs.controller';
import { SmsLogsService } from '../sms/sms-logs.service';
import { AdminBrandsController } from '../modules/brands/admin-brands.controller';
import { BrandsService } from '../modules/brands/brands.service';
import { AdminCategoriesController } from '../modules/categories/admin-categories.controller';
import { CategoriesService } from '../modules/categories/categories.service';
import { AdminPetTypesController } from '../modules/pet-types/admin-pet-types.controller';
import { PetTypesService } from '../modules/pet-types/pet-types.service';
import { AdminBreedsController } from '../modules/breeds/admin-breeds.controller';
import { BreedsService } from '../modules/breeds/breeds.service';
import { AdminTagsController } from '../modules/tags/admin-tags.controller';
import { TagsService } from '../modules/tags/tags.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

type ListCase = { path: string; query: Record<string, string>; expected: Record<string, unknown> };
const cases: ListCase[] = [
  {
    path: 'products',
    query: { search: 'خوراک', isActive: 'false', brandId: '3', categoryId: '4', petTypeId: '5' },
    expected: { search: 'خوراک', isActive: false, brandId: 3, categoryId: 4, petTypeId: 5 },
  },
  {
    path: 'users',
    query: { search: 'مدیر', role: 'ADMIN', status: 'BLOCKED' },
    expected: { search: 'مدیر', role: 'ADMIN', status: 'BLOCKED' },
  },
  {
    path: 'orders',
    query: {
      search: 'DR-1',
      status: 'PAID',
      userId: '7',
      from: '2026-10-01',
      to: '2026-10-17T12:00:00.000Z',
    },
    expected: {
      search: 'DR-1',
      status: 'PAID',
      userId: 7,
      from: '2026-10-01',
      to: '2026-10-17T12:00:00.000Z',
    },
  },
  {
    path: 'payments',
    query: { status: 'FAILED', gateway: 'zarinpal', from: '2026-10-01', to: '2026-10-17' },
    expected: { status: 'FAILED', gateway: 'zarinpal', from: '2026-10-01', to: '2026-10-17' },
  },
  {
    path: 'coupons',
    query: { search: 'SALE', isActive: 'false' },
    expected: { search: 'SALE', isActive: false },
  },
  {
    path: 'medicines',
    query: { q: 'دارو', isActive: 'false' },
    expected: { q: 'دارو', isActive: false },
  },
  {
    path: 'pharmacies',
    query: { q: 'مرکز', city: 'مشهد', province: 'خراسان رضوی', isActive: 'false' },
    expected: { q: 'مرکز', city: 'مشهد', province: 'خراسان رضوی', isActive: false },
  },
  {
    path: 'clinics',
    query: {
      q: 'کلینیک',
      city: 'مشهد',
      province: 'خراسان رضوی',
      isActive: 'false',
      isVerified: 'true',
    },
    expected: {
      q: 'کلینیک',
      city: 'مشهد',
      province: 'خراسان رضوی',
      isActive: false,
      isVerified: true,
    },
  },
  {
    path: 'audit-logs',
    query: { entity: 'ProductVariant', action: 'STATUS_CHANGE', adminId: '7' },
    expected: { entity: 'ProductVariant', action: 'STATUS_CHANGE', adminId: 7 },
  },
  {
    path: 'sms/logs',
    query: { phone: '0912', kind: 'OTP', status: 'FAILED' },
    expected: { phone: '0912', kind: 'OTP', status: 'FAILED' },
  },
];
const lists = Object.fromEntries(
  cases.map(({ path }) => [path, jest.fn().mockResolvedValue({ data: [] })]),
) as Record<string, jest.Mock>;
const references = Object.fromEntries(
  ['brands', 'categories', 'pet-types', 'breeds', 'tags'].map((path) => [
    path,
    jest.fn().mockResolvedValue([]),
  ]),
) as Record<string, jest.Mock>;
const reports = {
  sales: jest.fn().mockResolvedValue({}),
  buildSalesCsv: jest.fn().mockResolvedValue('csv'),
  userGrowth: jest.fn().mockResolvedValue({}),
  buildUserGrowthCsv: jest.fn().mockResolvedValue('csv'),
  topProducts: jest.fn().mockResolvedValue({}),
  buildTopProductsCsv: jest.fn().mockResolvedValue('csv'),
  lowStock: jest.fn().mockResolvedValue({}),
};
const dashboard = { getOverview: jest.fn().mockResolvedValue({}) };

describe('Admin filter HTTP boundaries (actual controllers, strict pipe, mocked services)', () => {
  let app: INestApplication;
  let url: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AdminProductsController,
        AdminUsersController,
        AdminOrdersController,
        AdminPaymentsController,
        AdminCouponsController,
        AdminMedicinesController,
        AdminPharmaciesController,
        AdminClinicsController,
        AuditController,
        AdminSmsLogsController,
        AdminBrandsController,
        AdminCategoriesController,
        AdminPetTypesController,
        AdminBreedsController,
        AdminTagsController,
        ReportsController,
        DashboardController,
      ],
      providers: [
        { provide: AdminProductsService, useValue: { findAllAdmin: lists.products } },
        { provide: ProductsImportService, useValue: {} },
        { provide: UsersService, useValue: { findAllAdmin: lists.users } },
        { provide: PasswordService, useValue: {} },
        { provide: AdminOrdersService, useValue: { findAllAdmin: lists.orders } },
        { provide: AdminPaymentsService, useValue: { findAllAdmin: lists.payments } },
        { provide: AdminCouponsService, useValue: { findAllAdmin: lists.coupons } },
        { provide: MedicinesService, useValue: { findAllAdmin: lists.medicines } },
        { provide: PharmaciesService, useValue: { findAllAdmin: lists.pharmacies } },
        { provide: ClinicsService, useValue: { findAllAdmin: lists.clinics } },
        { provide: AuditService, useValue: { findAll: lists['audit-logs'], record: jest.fn() } },
        { provide: SmsLogsService, useValue: { findAllAdmin: lists['sms/logs'] } },
        { provide: BrandsService, useValue: { findAllAdmin: references.brands } },
        { provide: CategoriesService, useValue: { findAllAdmin: references.categories } },
        { provide: PetTypesService, useValue: { findAllAdmin: references['pet-types'] } },
        { provide: BreedsService, useValue: { findAllAdmin: references.breeds } },
        { provide: TagsService, useValue: { findAllAdmin: references.tags } },
        { provide: ReportsService, useValue: reports },
        { provide: DashboardService, useValue: dashboard },
        { provide: PrismaService, useValue: {} },
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
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => app?.close());
  const get = (path: string, query: Record<string, string> = {}, role = 'ADMIN') =>
    fetch(`${url}/api/v1/admin/${path}?${new URLSearchParams(query)}`, {
      headers: { 'x-test-role': role },
    });

  it.each(cases)(
    'accepts and forwards all $path filters together with pagination',
    async ({ path, query, expected }) => {
      expect((await get(path, { page: '2', limit: '12', ...query })).status).toBe(200);
      expect(lists[path]).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 12, ...expected }),
      );
    },
  );
  it.each(cases)('preserves omitted filters and existing defaults for $path', async ({ path }) => {
    expect((await get(path)).status).toBe(200);
    expect(lists[path]).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
    const forwarded = lists[path].mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(forwarded)).toEqual(['page', 'limit']);
  });
  it.each(cases)(
    'rejects unknown filters before calling $path service',
    async ({ path, query }) => {
      const response = await get(path, { ...query, unexpected: 'true' });
      expect(response.status).toBe(400);
      expect((await response.json()).message).toContain('property unexpected should not exist');
      expect(lists[path]).not.toHaveBeenCalled();
    },
  );
  it.each(cases)(
    'retains pagination bounds and ADMIN access for $path',
    async ({ path, query }) => {
      expect((await get(path, { ...query, limit: '51' })).status).toBe(400);
      expect((await get(path, { ...query, page: '0' })).status).toBe(400);
      expect((await get(path, query, 'USER')).status).toBe(403);
      expect(lists[path]).not.toHaveBeenCalled();
    },
  );
  it('preserves the provider legacy PENDING payment status filter', async () => {
    expect((await get('payments', { status: 'PENDING' })).status).toBe(200);
    expect(lists.payments).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }));
  });
  it.each([
    ['products', { isActive: 'not-a-boolean' }],
    ['products', { brandId: '0' }],
    ['products', { categoryId: 'NaN' }],
    ['products', { petTypeId: '1.5' }],
    ['products', { brandId: '2147483648' }],
    ['users', { role: 'ROOT' }],
    ['users', { status: 'DISABLED' }],
    ['orders', { status: 'REFUNDED' }],
    ['orders', { userId: '-1' }],
    ['orders', { from: '2026-02-30' }],
    ['payments', { status: 'PAID' }],
    ['payments', { to: 'invalid-date' }],
    ['clinics', { isVerified: '0' }],
    ['audit-logs', { adminId: '0' }],
    ['sms/logs', { kind: 'PASSWORD' }],
    ['sms/logs', { status: 'QUEUED' }],
  ] as Array<[string, Record<string, string>]>)(
    'rejects malformed %s filter %#',
    async (path, query) => {
      expect((await get(path, query)).status).toBe(400);
      expect(lists[path]).not.toHaveBeenCalled();
    },
  );

  it.each(['brands', 'pet-types'])(
    'validates %s search/active reference filters without adding pagination',
    async (path) => {
      expect((await get(path, { search: 'مرجع', isActive: 'false' })).status).toBe(200);
      expect(references[path]).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'مرجع', isActive: false }),
      );
      expect((await get(path, { page: '1' })).status).toBe(400);
    },
  );
  it.each(['categories', 'breeds'])(
    'preserves %s species scoping and false active filters',
    async (path) => {
      expect((await get(path, { search: 'مرجع', petTypeId: '3', isActive: 'false' })).status).toBe(
        200,
      );
      expect(references[path]).toHaveBeenCalledWith(3, { search: 'مرجع', isActive: false });
      expect((await get(path, { petTypeId: '0' })).status).toBe(400);
    },
  );
  it('preserves tag type semantics and rejects foreign endpoint filters', async () => {
    expect(
      (await get('tags', { type: 'ALLERGEN', search: 'مرجع', isActive: 'false' })).status,
    ).toBe(200);
    expect(references.tags).toHaveBeenCalledWith('ALLERGEN', { search: 'مرجع', isActive: false });
    expect((await get('tags', { type: 'OTHER' })).status).toBe(400);
    expect((await get('medicines', { search: 'wrong-key' })).status).toBe(400);
    expect((await get('products', { status: 'ACTIVE' })).status).toBe(400);
  });

  const range = {
    from: '2026-10-01T00:00:00.000Z',
    to: '2026-10-17T00:00:00.000Z',
    tz: 'Asia/Tehran',
  };
  it.each([
    ['sales', 'sales'],
    ['sales.csv', 'buildSalesCsv'],
    ['users', 'userGrowth'],
    ['users.csv', 'buildUserGrowthCsv'],
  ] as const)('keeps report %s dates and timezone intact', async (path, method) => {
    expect((await get(`reports/${path}`, range)).status).toBe(200);
    expect(reports[method]).toHaveBeenCalledWith(expect.objectContaining(range));
    expect((await get(`reports/${path}`, { ...range, status: 'PAID' })).status).toBe(400);
  });
  it.each([
    ['top-products', 'topProducts'],
    ['top-products.csv', 'buildTopProductsCsv'],
  ] as const)('validates %s limit independently of report range', async (path, method) => {
    expect((await get(`reports/${path}`, { ...range, limit: '20' })).status).toBe(200);
    expect(reports[method]).toHaveBeenCalledWith(range, 20);
    expect((await get(`reports/${path}`)).status).toBe(200);
    expect(reports[method]).toHaveBeenLastCalledWith({}, undefined);
    expect((await get(`reports/${path}`, { limit: '0' })).status).toBe(400);
  });
  it('keeps zero low-stock threshold and omitted dashboard/report defaults', async () => {
    expect((await get('reports/low-stock', { threshold: '0' })).status).toBe(200);
    expect(reports.lowStock).toHaveBeenCalledWith(0);
    expect((await get('reports/low-stock')).status).toBe(200);
    expect(reports.lowStock).toHaveBeenLastCalledWith(undefined);
    expect((await get('dashboard', { tz: 'Asia/Tehran' })).status).toBe(200);
    expect(dashboard.getOverview).toHaveBeenCalledWith('Asia/Tehran');
    expect((await get('dashboard')).status).toBe(200);
    expect(dashboard.getOverview).toHaveBeenLastCalledWith(undefined);
    expect((await get('reports/sales', { from: '2026-02-30' })).status).toBe(400);
    expect((await get('dashboard', { role: 'ADMIN' })).status).toBe(400);
  });
});
