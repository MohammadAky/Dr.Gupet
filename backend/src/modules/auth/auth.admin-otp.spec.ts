import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { OtpService } from './otp/otp.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SmsService } from '../../sms/sms.service';
import { AllExceptionsFilter, AppException } from '../../common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Match the existing HTTP test adapter without adding declaration dependencies.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
const phone = '09121234567';
const administrator = {
  id: 7,
  phone,
  role: 'ADMIN',
  status: 'ACTIVE',
  deletedAt: null,
  isPhoneVerified: true,
  sessionVersion: 0,
  firstName: null,
  lastName: null,
  avatar: null,
  passwordCredential: null,
};

describe('Administrator OTP HTTP boundary (isolated DB, OTP and SMS)', () => {
  let app: INestApplication;
  let auth: AuthService;
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
  const otp = { generate: jest.fn(), verify: jest.fn(), discard: jest.fn() };
  const sms = { sendOtp: jest.fn() };
  const redis = { set: jest.fn() };
  const jwt = { sign: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue({ ...administrator });
    otp.generate.mockResolvedValue('123456');
    otp.verify.mockResolvedValue(true);
    sms.sendOtp.mockResolvedValue(undefined);
    jwt.sign.mockReturnValue('test-token');
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PasswordService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        { provide: OtpService, useValue: otp },
        { provide: SmsService, useValue: sms },
        { provide: RedisService, useValue: redis },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();
    auth = module.get(AuthService);
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  const denied = [
    ['unknown', null],
    ['customer', { ...administrator, role: 'USER' }],
    ['blocked admin', { ...administrator, status: 'BLOCKED' }],
    ['deleted admin', { ...administrator, deletedAt: new Date('2026-01-01') }],
    ['unexpected status', { ...administrator, status: 'PENDING' }],
  ] as const;

  it.each(denied)('rejects %s before generating or delivering SMS', async (_reason, account) => {
    prisma.user.findUnique.mockResolvedValue(account);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/otp/request')
      .send({ phone });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ADMIN_REQUIRED');
    expect(otp.generate).not.toHaveBeenCalled();
    expect(sms.sendOtp).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it.each(denied)(
    'rejects %s before consuming proof or creating a session',
    async (_reason, account) => {
      prisma.user.findUnique.mockResolvedValue(account);
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/admin/otp/verify')
        .send({ phone, code: '123456' });
      expect(response.status).toBe(403);
      expect(otp.verify).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    },
  );

  it.each(['+989121234567', '00989121234567', '9121234567', '۰۹۱۲۱۲۳۴۵۶۷'])(
    'normalizes %s before the admin eligibility lookup and SMS',
    async (input) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/admin/otp/request')
        .send({ phone: input });
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ expiresIn: 120, cooldownSeconds: 60 });
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { phone } }),
      );
      expect(otp.generate).toHaveBeenCalledWith(phone);
      expect(sms.sendOtp).toHaveBeenCalledWith(phone, '123456');
    },
  );

  it('verifies normalized proof for the existing active administrator without provisioning', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/otp/verify')
      .send({ phone: '+989121234567', code: '123456' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      accessToken: 'test-token',
      user: { id: 7, phone },
      isNewUser: false,
    });
    expect(otp.verify).toHaveBeenCalledWith(phone, '123456');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 7, role: 'ADMIN' }),
      expect.anything(),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('marks only the eligible existing administrator phone verified', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...administrator, isPhoneVerified: false });
    prisma.user.update.mockResolvedValue(administrator);
    await auth.verifyAdminOtp(phone, '123456');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7, phone, role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
        data: { isPhoneVerified: true },
      }),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it.each(denied)(
    'rejects authority changed during verification to %s',
    async (_reason, account) => {
      otp.verify.mockImplementationOnce(async () => {
        prisma.user.findUnique.mockResolvedValue(account);
        return true;
      });
      await expect(auth.verifyAdminOtp(phone, '123456')).rejects.toMatchObject({
        code: 'ADMIN_REQUIRED',
      });
      expect(jwt.sign).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    },
  );

  it('rejects an account replaced during verification', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(administrator)
      .mockResolvedValueOnce({ ...administrator, id: 8 });
    await expect(auth.verifyAdminOtp(phone, '123456')).rejects.toMatchObject({
      code: 'ADMIN_REQUIRED',
    });
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it.each(['OTP_EXPIRED', 'OTP_INVALID', 'OTP_RATE_LIMITED'])(
    'preserves %s verification failure without issuing tokens',
    async (code) => {
      otp.verify.mockRejectedValueOnce(new AppException(code, 'کد معتبر نیست', 400));
      await expect(auth.verifyAdminOtp(phone, '123456')).rejects.toMatchObject({ code });
      expect(jwt.sign).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    },
  );

  it('preserves delivery failure cleanup and shared phone quota identity', async () => {
    sms.sendOtp.mockRejectedValueOnce(new Error('isolated delivery failure'));
    await expect(auth.requestAdminOtp(phone)).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(otp.generate).toHaveBeenCalledWith(phone);
    expect(otp.discard).toHaveBeenCalledWith(phone);
  });

  it.each([{ phone: '123' }, { phone, purpose: 'admin' }, { phone, role: 'ADMIN' }])(
    'rejects malformed or extra admin request fields %j before side effects',
    async (body) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/admin/otp/request')
        .send(body);
      expect(response.status).toBe(400);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(otp.generate).not.toHaveBeenCalled();
      expect(sms.sendOtp).not.toHaveBeenCalled();
    },
  );

  it('keeps the administrator request limit at ten per minute', async () => {
    for (let count = 0; count < 10; count++) {
      expect(
        (await request(app.getHttpServer()).post('/api/v1/auth/admin/otp/request').send({ phone }))
          .status,
      ).toBe(201);
    }
    expect(
      (await request(app.getHttpServer()).post('/api/v1/auth/admin/otp/request').send({ phone }))
        .status,
    ).toBe(429);
    expect(sms.sendOtp).toHaveBeenCalledTimes(10);
  });

  it('preserves public customer OTP and registration requests for a new phone', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    for (const path of ['otp/request', 'password/register/request-otp']) {
      expect(
        (await request(app.getHttpServer()).post(`/api/v1/auth/${path}`).send({ phone })).status,
      ).toBe(201);
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(sms.sendOtp).toHaveBeenCalledTimes(2);
  });

  it('preserves generic OTP customer creation without granting administrator authority', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ ...administrator, id: 9, role: 'USER' });
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone, code: '123456' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ isNewUser: true, user: { id: 9 } });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { phone, isPhoneVerified: true, cart: { create: {} } } }),
    );
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 9, role: 'USER' }),
      expect.anything(),
    );
  });
});
