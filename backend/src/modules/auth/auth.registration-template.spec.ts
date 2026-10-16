import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SmsService } from '../../sms/sms.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp/otp.service';
import { PasswordService } from './password.service';

// Match the existing HTTP specs without adding supertest declaration dependencies.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Registration OTP temporarily shares the login template (isolated provider)', () => {
  let app: INestApplication;
  const send = jest.fn();
  const configReads = jest.fn();
  const generate = jest.fn();

  beforeAll(async () => {
    const values: Record<string, string> = {
      'app.nodeEnv': 'test',
      'sms.driver': 'smsir',
      'sms.apiKey': 'isolated-test-key',
      'sms.templateId': '448272',
      'sms.paramName': 'Code',
      'sms.usernameRecoveryTemplateId': '604019',
      'sms.usernameRecoveryParamName': 'CODE',
    };
    configReads.mockImplementation((key: string) => values[key]);
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        SmsService,
        { provide: PasswordService, useValue: {} },
        { provide: ConfigService, useValue: { get: configReads } },
        { provide: PrismaService, useValue: { smsLog: { create: jest.fn() } } },
        { provide: RedisService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: OtpService, useValue: { generate, discard: jest.fn() } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    send.mockReset().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 1, data: { messageId: 7 } }),
    });
    generate.mockReset().mockResolvedValue('123456');
    configReads.mockClear();
    jest.spyOn(global, 'fetch').mockImplementation(send);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends signup and login through the same configured template and parameter, excluding reserved recovery', async () => {
    for (const path of ['password/register/request-otp', 'otp/request']) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/auth/${path}`)
        .send({ phone: '+989121234567' });
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ expiresIn: 120, cooldownSeconds: 60 });
    }
    expect(send).toHaveBeenCalledTimes(2);
    for (const [url, init] of send.mock.calls as Array<[string, RequestInit]>) {
      expect(url).toBe('https://api.sms.ir/v1/send/verify');
      expect(JSON.parse(String(init.body))).toEqual({
        mobile: '09121234567',
        templateId: 448272,
        parameters: [{ name: 'Code', value: '123456' }],
      });
    }
    expect(generate.mock.calls).toEqual([['09121234567'], ['09121234567']]);
    expect(configReads.mock.calls.some(([key]: [string]) => /recovery/i.test(key))).toBe(false);
  });
});
