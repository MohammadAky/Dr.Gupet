import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

type ConfigValues = Record<string, string | undefined>;

function makeService(driver?: string, extra: ConfigValues = {}) {
  const values: ConfigValues = { 'sms.driver': driver, 'app.nodeEnv': 'test', ...extra };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  const smsLog = {
    create: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
  };
  const prisma = { smsLog } as any;
  const service = new SmsService(config, prisma);
  return { service, smsLog };
}

const fetchMock = jest.fn();

describe('SmsService driver selection', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('defaults to the console driver (no network)', async () => {
    const { service } = makeService(undefined);

    await expect(service.sendOtp('09121234567', '123456')).resolves.toBeUndefined();
    await expect(service.sendText('09121234567', 'متن')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown driver at startup (issue #04: no silent fallback)', () => {
    expect(() => makeService('kavenegar')).toThrow(/Unknown SMS_DRIVER/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects the console driver in production (config-based nodeEnv)', () => {
    expect(() => makeService('console', { 'app.nodeEnv': 'production' })).toThrow(
      /not allowed in production/,
    );
  });

  it('uses the sms.ir driver when SMS_DRIVER=smsir (missing config fails fast)', async () => {
    const { service } = makeService('smsir');

    // No SMS_API_KEY configured → the real driver rejects before any network call.
    await expect(service.sendOtp('09121234567', '123456')).rejects.toThrow(
      'SMS_API_KEY is missing',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('SmsService delivery logging (SmsLog)', () => {
  it('records a SENT row with kind OTP for successful sends', async () => {
    const { service, smsLog } = makeService(undefined);
    await service.sendOtp('09121234567', '123456');
    expect(smsLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ phone: '09121234567', kind: 'OTP', status: 'SENT' }),
    });
  });

  it('records a FAILED row with a safe error summary and rethrows', async () => {
    const { service, smsLog } = makeService('smsir');
    await expect(service.sendOtp('09121234567', '123456')).rejects.toThrow();
    expect(smsLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'OTP',
        status: 'FAILED',
        error: expect.stringContaining('SMS_API_KEY'),
      }),
    });
  });

  it('records notifications with kind NOTIFY', async () => {
    const { service, smsLog } = makeService(undefined);
    await service.sendText('09121234567', 'متن');
    expect(smsLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'NOTIFY', status: 'SENT' }),
    });
  });

  it('never lets a logging failure break delivery', async () => {
    const { service, smsLog } = makeService(undefined);
    smsLog.create.mockRejectedValue(new Error('db down'));
    await expect(service.sendOtp('09121234567', '123456')).resolves.toBeUndefined();
  });
});
