import { UnauthorizedException } from '@nestjs/common';
import { OtpService } from './otp/otp.service';
import { AuthService } from './auth.service';
import { AppException } from '../../common/filters/all-exceptions.filter';

/**
 * Fake Redis with atomic DEL semantics (DEL returns how many keys were removed).
 * Each call yields the event loop first so concurrent requests truly interleave.
 */
class FakeRedis {
  private store = new Map<string, string>();
  private counters = new Map<string, number>();

  private yield() {
    return new Promise((resolve) => setImmediate(resolve));
  }

  async get(key: string): Promise<string | null> {
    await this.yield();
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _ttl?: number): Promise<void> {
    await this.yield();
    this.store.set(key, value);
  }

  async del(...keys: string[]): Promise<number> {
    await this.yield();
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) removed++;
    }
    return removed;
  }

  async incr(key: string): Promise<number> {
    await this.yield();
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }

  async expire(): Promise<boolean> {
    await this.yield();
    return true;
  }

  async ttl(): Promise<number> {
    await this.yield();
    return 60;
  }

  async setNx(key: string, value: string): Promise<boolean> {
    // Atomic (as Redis SET NX is): check+set with no yield in between.
    if (this.store.has(key)) return false;
    this.store.set(key, value);
    return true;
  }

  async exists(key: string): Promise<boolean> {
    await this.yield();
    return this.store.has(key);
  }
}

const configStub = {
  get: (key: string) => {
    if (key === 'jwt.accessSecret') return 'test-secret';
    return undefined;
  },
};

function makeOtpService() {
  const redis = new FakeRedis();
  const otp = new OtpService(redis as any, configStub as any);
  return { redis, otp };
}

function makeAuthService(redis: FakeRedis, refreshPayload: { sub: number; jti: string } | null) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        role: 'USER',
        status: 'ACTIVE',
      }),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  };
  const jwtService = {
    verify: jest.fn().mockImplementation(() => {
      if (!refreshPayload) throw new Error('invalid');
      return refreshPayload;
    }),
    sign: jest.fn().mockReturnValue('signed-token'),
  };
  const sms = { sendOtp: jest.fn(), sendText: jest.fn() };
  const otpService = {
    generate: jest.fn().mockResolvedValue('12345'),
    verify: jest.fn().mockResolvedValue(true),
  };
  const config = {
    get: (key: string) => {
      if (key === 'jwt.refreshSecret') return 'refresh-secret';
      return undefined;
    },
  };
  const service = new AuthService(
    prisma as any,
    redis as any,
    sms as any,
    otpService as any,
    jwtService as any,
    config as any,
  );
  return { service, prisma };
}

describe('OTP concurrent verification (issue #7)', () => {
  it('exactly one of two concurrent verifications succeeds', async () => {
    const { otp } = makeOtpService();
    const phone = '09121234567';
    const code = await otp.generate(phone);

    const results = await Promise.allSettled([otp.verify(phone, code), otp.verify(phone, code)]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // The loser sees a definitive error, not a crash
    expect(rejected[0].reason).toBeInstanceOf(AppException);
  });

  it('a code cannot be reused after a successful verification', async () => {
    const { otp } = makeOtpService();
    const phone = '09121234568';
    const code = await otp.generate(phone);

    await expect(otp.verify(phone, code)).resolves.toBe(true);
    await expect(otp.verify(phone, code)).rejects.toThrow(AppException);
  });

  it('wrong codes do not consume the OTP (retry still possible)', async () => {
    const { otp } = makeOtpService();
    const phone = '09121234569';
    const code = await otp.generate(phone);
    const wrong = code === '000000' ? '999999' : '000000';

    await expect(otp.verify(phone, wrong)).rejects.toThrow(AppException);
    await expect(otp.verify(phone, code)).resolves.toBe(true);
  });
});

describe('Refresh token rotation (issue #7)', () => {
  const payload = { sub: 1, jti: 'jti-1' };

  it('exactly one of two concurrent refreshes succeeds', async () => {
    const redis = new FakeRedis();
    await redis.set(`refresh:1:jti-1`, '1', 30 * 24 * 3600);
    const { service } = makeAuthService(redis, payload);

    const results = await Promise.allSettled([
      service.refreshTokens('rt'),
      service.refreshTokens('rt'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(UnauthorizedException);
  });

  it('a refresh token cannot be reused sequentially (rotation enforced)', async () => {
    const redis = new FakeRedis();
    await redis.set(`refresh:1:jti-1`, '1', 30 * 24 * 3600);
    const { service } = makeAuthService(redis, payload);

    await expect(service.refreshTokens('rt')).resolves.toEqual({
      accessToken: 'signed-token',
      refreshToken: 'signed-token',
    });
    await expect(service.refreshTokens('rt')).rejects.toThrow(UnauthorizedException);
  });

  it('logout removes the stored refresh token', async () => {
    const redis = new FakeRedis();
    await redis.set(`refresh:1:jti-1`, '1', 30 * 24 * 3600);
    const { service } = makeAuthService(redis, payload);

    await expect(service.logout(1, 'rt')).resolves.toEqual({ ok: true });
    // After logout the refresh token is gone — a refresh must fail
    await expect(service.refreshTokens('rt')).rejects.toThrow(UnauthorizedException);
  });
});
