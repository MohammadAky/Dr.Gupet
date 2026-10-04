import { OtpService } from './otp/otp.service';
import { AuthService } from './auth.service';
import { AppException } from '../../common/filters/all-exceptions.filter';

/** Minimal fake Redis — enough for OtpService.generate/discard. */
class FakeRedis {
  private store = new Map<string, string>();
  private counters = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) removed++;
    }
    return removed;
  }

  async incr(key: string): Promise<number> {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }

  async expire(): Promise<boolean> {
    return true;
  }

  async setNx(key: string, value: string): Promise<boolean> {
    if (this.store.has(key)) return false;
    this.store.set(key, value);
    return true;
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}

const configStub = {
  get: (key: string) => {
    if (key === 'jwt.accessSecret') return 'test-secret';
    if (key === 'jwt.refreshSecret') return 'refresh-secret';
    return undefined;
  },
};

function makeHarness(sendOtp: jest.Mock) {
  const redis = new FakeRedis();
  const otpService = new OtpService(redis as any, configStub as any);
  const sms = { sendOtp, sendText: jest.fn() };
  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const jwtService = { sign: jest.fn().mockReturnValue('signed-token'), verify: jest.fn() };
  const service = new AuthService(
    prisma as any,
    redis as any,
    sms as any,
    otpService as any,
    jwtService as any,
    configStub as any,
  );
  return { service, redis, sms, prisma };
}

describe('AuthService.requestOtp (OTP delivery via generic SmsService)', () => {
  it('stores a hashed code and hands it to the SMS sender', async () => {
    const { service, redis, sms } = makeHarness(jest.fn().mockResolvedValue(undefined));

    const result = await service.requestOtp('09121234567');

    expect(sms.sendOtp).toHaveBeenCalledWith(
      '09121234567',
      expect.stringMatching(/^\d{6}$/),
    );
    // Redis holds only the hash, never the plain code
    const stored = await redis.get('otp:09121234567');
    expect(stored).toBeTruthy();
    expect(stored).not.toBe(sms.sendOtp.mock.calls[0][1]);
    expect(result).toEqual({ expiresIn: 120, cooldownSeconds: 60 });
  });

  it('discards the OTP and its cooldown when delivery fails', async () => {
    const { service, redis } = makeHarness(jest.fn().mockRejectedValue(new Error('boom')));

    await expect(service.requestOtp('09121234567')).rejects.toBeInstanceOf(AppException);

    // No burned/locked code: both keys are gone so the user can retry immediately
    expect(await redis.get('otp:09121234567')).toBeNull();
    expect(await redis.exists('otp:cooldown:09121234567')).toBe(false);
  });

  it('allows an immediate retry after a failed delivery', async () => {
    const sms = {
      sendOtp: jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(undefined),
      sendText: jest.fn(),
    };
    const redis = new FakeRedis();
    const otpService = new OtpService(redis as any, configStub as any);
    const service = new AuthService(
      {} as any,
      redis as any,
      sms as any,
      otpService as any,
      { sign: jest.fn() } as any,
      configStub as any,
    );

    await expect(service.requestOtp('09121234567')).rejects.toBeInstanceOf(AppException);
    await expect(service.requestOtp('09121234567')).resolves.toEqual({
      expiresIn: 120,
      cooldownSeconds: 60,
    });
    expect(sms.sendOtp).toHaveBeenCalledTimes(2);
  });
});
