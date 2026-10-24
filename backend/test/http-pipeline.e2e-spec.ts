import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { IsInt, Max, Min } from 'class-validator';
import { HealthController } from '../src/health/health.controller';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';

// The repository's HTTP adapter, without adding a type dependency.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

/**
 * E2E gate for the global HTTP pipeline (issue #23).
 *
 * This boots a real Nest application with the same prefix, ValidationPipe,
 * exception filter and response interceptor used by `src/main.ts`, and talks to
 * it over HTTP. It intentionally needs no database, Redis or SMS provider, so it
 * can run in CI; live MySQL/OTP/gateway acceptance still requires a deployed
 * environment and is not claimed here.
 */
class ProbeDto {
  @IsInt()
  @Min(1)
  @Max(10)
  quantity: number;
}

import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CreateClinicDto, UpdateClinicDto } from '../src/modules/clinics/dto/admin-clinic.dto';
import { CreateMedicineDto } from '../src/modules/medicines/dto/admin-medicine.dto';
import { CreatePharmacyDto } from '../src/modules/pharmacies/dto/admin-pharmacy.dto';

/**
 * Issue #19 regression slot: the real care-directory DTOs, mounted behind the
 * same global ValidationPipe. An inline TypeScript object would accept all the
 * payloads asserted below, so these cases fail if the DTOs stop being classes.
 */
@Controller('care-probe')
class CareProbeController {
  @Post('clinic')
  createClinic(@Body() body: CreateClinicDto) {
    return body;
  }

  @Patch('clinic/:id')
  updateClinic(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateClinicDto) {
    return { id, ...body };
  }

  @Post('pharmacy')
  createPharmacy(@Body() body: CreatePharmacyDto) {
    return body;
  }

  @Post('medicine')
  createMedicine(@Body() body: CreateMedicineDto) {
    return body;
  }
}

@Controller('probe')
class ProbeController {
  @Get()
  read() {
    return { status: 'ok' };
  }

  @Post()
  write(@Body() body: ProbeDto) {
    return { quantity: body.quantity };
  }
}

describe('Global HTTP pipeline (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController, ProbeController, CareProbeController],
      providers: [Reflector],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor(module.get(Reflector)));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the public health envelope used by deployment gates', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('accepts a valid typed body and keeps the success envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe')
      .send({ quantity: 3 });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true, data: { quantity: 3 } });
  });

  it.each([
    ['fractional number', { quantity: 1.5 }],
    ['out-of-range number', { quantity: 11 }],
    ['string number', { quantity: '3' }],
    ['unknown field', { quantity: 2, role: 'ADMIN' }],
    ['missing field', {}],
  ])('rejects %s with a 400 validation envelope', async (_label, body) => {
    const response = await request(app.getHttpServer()).post('/api/v1/probe').send(body);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
  });

  const clinic = {
    name: '  کلینیک دامپزشکی مهر  ',
    province: 'خراسان رضوی',
    city: 'مشهد',
    address: 'بلوار وکیل‌آباد، پلاک ۱۲',
    lat: null,
    lng: null,
    is24h: false,
  };

  it('accepts the care create contracts and trims text before returning it', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/care-probe/clinic')
      .send(clinic);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ name: 'کلینیک دامپزشکی مهر', lat: null, lng: null });

    const pharmacy = await request(app.getHttpServer())
      .post('/api/v1/care-probe/pharmacy')
      .send({ ...clinic, name: 'داروخانه مهر', onDuty: true });
    expect(pharmacy.status).toBe(201);
    expect(pharmacy.body.data).toMatchObject({ onDuty: true, name: 'داروخانه مهر' });

    const medicine = await request(app.getHttpServer())
      .post('/api/v1/care-probe/medicine')
      .send({ name: 'قرص ضد انگل', petTypeIds: [1, 2], requiresPrescription: true });
    expect(medicine.status).toBe(201);
    expect(medicine.body.data).toMatchObject({ petTypeIds: [1, 2], requiresPrescription: true });
  });

  it.each([
    ['unknown field', { ...clinic, isFeatured: true }],
    ['string coordinate', { ...clinic, lat: '35.5' }],
    ['out-of-range coordinate', { ...clinic, lat: 91 }],
    ['fractional coordinate', { ...clinic, lat: 35.1234567 }],
    ['string boolean', { ...clinic, is24h: 'yes' }],
    ['one-character name', { ...clinic, name: 'ک' }],
    ['missing required city', { ...clinic, city: undefined }],
  ])('rejects a clinic body with %s', async (_label, body) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/care-probe/clinic')
      .send(body);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
  });

  it.each([
    ['unknown field', { name: 'دارو', dosage: '2/day' }],
    ['fractional pet type id', { name: 'دارو', petTypeIds: [1.5] }],
    ['non-array pet type ids', { name: 'دارو', petTypeIds: '1,2' }],
    ['missing name', { brand: 'بدون نام' }],
    ['script image url', { name: 'دارو', image: 'javascript:alert(1)' }],
    ['external http image', { name: 'دارو', image: 'http://example.com/a.png' }],
    ['empty name', { name: '   ' }],
  ])('rejects a medicine body with %s', async (_label, body) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/care-probe/medicine')
      .send(body);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
  });

  it('coerces numeric strings for ids so admin form encodings stay usable', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/care-probe/medicine')
      .send({ name: 'دارو', petTypeIds: ['1', '2'] });
    expect(response.status).toBe(201);
    expect(response.body.data.petTypeIds).toEqual([1, 2]);
  });

  it('accepts a partial PATCH and still rejects unknown keys', async () => {
    const ok = await request(app.getHttpServer())
      .patch('/api/v1/care-probe/clinic/7')
      .send({ isActive: false, lat: 36.3 });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ success: true, data: { id: 7, isActive: false, lat: 36.3 } });

    const bad = await request(app.getHttpServer())
      .patch('/api/v1/care-probe/clinic/7')
      .send({ isActive: 'no' });
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
  });

  it('returns a structured 404 instead of a bare HTML error', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, statusCode: 404 });
  });
});
