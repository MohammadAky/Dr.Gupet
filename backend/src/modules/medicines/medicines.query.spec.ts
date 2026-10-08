import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { MedicineQueryDto } from './dto/medicine-query.dto';
import { MedicinesController } from './medicines.controller';
import { MedicinesService } from './medicines.service';

describe('Public medicine query HTTP validation (issue #21)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const service = {
    findAll: jest.fn(async (query: MedicineQueryDto) => ({
      data: [],
      meta: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
    })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MedicinesController],
      providers: [{ provide: MedicinesService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    // The same validation options used by src/main.ts, with the real controller metadata.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  beforeEach(() => service.findAll.mockClear());

  afterAll(async () => {
    await app?.close();
  });

  async function get(query = '') {
    const response = await fetch(`${baseUrl}/api/v1/medicines${query}`);
    return { status: response.status, body: await response.json() };
  }

  it('uses numeric pagination defaults when no query is supplied', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const query = service.findAll.mock.calls[0][0];
    expect(query).toBeInstanceOf(MedicineQueryDto);
    expect(query.requiresPrescription).toBeUndefined();
    expect(query.petTypeId).toBeUndefined();
  });

  it.each(['true', 'false'])('converts HTTP pagination, pet ID and %s boolean', async (value) => {
    const response = await get(`?page=2&limit=12&petTypeId=1&requiresPrescription=${value}`);
    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ page: 2, limit: 12, total: 0, totalPages: 0 });
    const query = service.findAll.mock.calls[0][0];
    expect(query).toBeInstanceOf(MedicineQueryDto);
    expect(query).toMatchObject({
      page: 2,
      limit: 12,
      petTypeId: 1,
      requiresPrescription: value === 'true',
    });
  });

  it('trims Persian and Arabic search text while preserving it for service normalization', async () => {
    const q = '  داروی گربه كبد  ';
    const response = await get(`?${new URLSearchParams({ q })}`);
    expect(response.status).toBe(200);
    expect(service.findAll.mock.calls[0][0].q).toBe('داروی گربه كبد');
  });

  it('accepts the limit and trimmed search length boundaries', async () => {
    const response = await get(
      `?${new URLSearchParams({ limit: '50', q: ` ${'د'.repeat(100)} ` })}`,
    );
    expect(response.status).toBe(200);
    expect(service.findAll.mock.calls[0][0]).toMatchObject({ limit: 50, q: 'د'.repeat(100) });
  });

  it('accepts an empty search after trimming', async () => {
    const response = await get('?q=%20%20');
    expect(response.status).toBe(200);
    expect(service.findAll.mock.calls[0][0].q).toBe('');
  });

  it.each([
    '?page=0',
    '?page=-1',
    '?page=1.5',
    '?page=abc',
    '?page=',
    '?limit=0',
    '?limit=51',
    '?limit=1.5',
    '?limit=abc',
    '?limit=',
    '?petTypeId=0',
    '?petTypeId=-1',
    '?petTypeId=1.5',
    '?petTypeId=abc',
    '?petTypeId=',
    '?requiresPrescription=maybe',
    '?requiresPrescription=1',
    '?requiresPrescription=0',
    '?requiresPrescription=TRUE',
    '?requiresPrescription=',
    '?requiresPrescription=%20true%20',
    `?q=${'x'.repeat(101)}`,
    '?unknown=value',
    '?q=a&q=b',
    '?q[]=a',
    '?q[name]=a',
    '?page=1&page=2',
    '?limit=12&limit=20',
    '?petTypeId=1&petTypeId=2',
    '?requiresPrescription=true&requiresPrescription=false',
  ])('rejects invalid query %s before calling the service', async (query) => {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
    expect(service.findAll).not.toHaveBeenCalled();
  });
});
