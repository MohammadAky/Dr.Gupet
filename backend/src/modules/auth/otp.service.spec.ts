import { OtpService } from './otp.service';
import { AppException } from '../../common/filters/all-exceptions.filter';

/** Minimal fake Redis — enough for OtpService.generate/verify/discard. */
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

type OtpOverrides = Record<string, unknown>;

function makeOtp(overrides: OtpOverrides = {}) {
  const config = {
    get: (key: string) => {
      const values: OtpOverrides = {
        'app.nodeEnv': 'production',
        'otp.ttlSeconds': 120,
        'otp.resendCooldownSeconds': 60,
        'otp.maxPerHour': 5,
        'otp.maxVerifyAttempts': 5,
        'jwt.accessSecret': 'test-secret',
        ...overrides,
      };
      return values[key];
    },
  };
  const redis = new FakeRedis();
  const otp = new OtpService(redis as any, config as any);
  return { redis, otp };
}

describe('OtpService', () => {
  describe('generate', () => {
    it('returns a 6-digit code and stores only its hash', async () => {
      const { redis, otp } = makeOtp();

      const code = await otp.generate('09121234567');

      expect(code).toMatch(/^\d{6}$/);
      const stored = await redis.get('otp:09121234567');
      expect(stored).toBeTruthy();
      expect(stored).not.toBe(code);
    });

    it('returns the dev code when configured outside production', async () => {
      const { otp } = makeOtp({ 'app.nodeEnv': 'development', 'otp.devCode': '12345' });

      await expect(otp.generate('09121234567')).resolves.toBe('12345');
    });

    it('rate-limits while the resend cooldown is active', async () => {
      const { otp } = makeOtp();

      await otp.generate('09121234567');
      await expect(otp.generate('09121234567')).rejects.toMatchObject({
        code: 'OTP_RATE_LIMITED',
      });
    });

    it('atomically claims the cooldown — only one of two concurrent generates wins (issue #03)', async () => {
      const { otp } = makeOtp();

      const results = await Promise.allSettled([
        otp.generate('09121234567'),
        otp.generate('09121234567'),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
        code: 'OTP_RATE_LIMITED',
      });
    });

    it('rate-limits after maxPerHour requests even without cooldown', async () => {
      const { redis, otp } = makeOtp({ 'otp.maxPerHour': 2, 'otp.resendCooldownSeconds': 0 });

      await otp.generate('09121234567');
      // Simulate cooldown elapsed
      await redis.del('otp:cooldown:09121234567');
      await otp.generate('09121234567');
      await redis.del('otp:cooldown:09121234567');
      await expect(otp.generate('09121234567')).rejects.toMatchObject({
        code: 'OTP_RATE_LIMITED',
      });
    });
  });

  describe('verify', () => {
    it('accepts the correct code exactly once', async () => {
      const { otp } = makeOtp();
      const code = await otp.generate('09121234567');

      await expect(otp.verify('09121234567', code)).resolves.toBe(true);
      await expect(otp.verify('09121234567', code)).rejects.toBeInstanceOf(AppException);
    });

    it('rejects a wrong code without consuming the OTP', async () => {
      const { otp } = makeOtp();
      const code = await otp.generate('09121234567');
      const wrong = code === '000000' ? '999999' : '000000';

      await expect(otp.verify('09121234567', wrong)).rejects.toMatchObject({
        code: 'OTP_INVALID',
      });
      await expect(otp.verify('09121234567', code)).resolves.toBe(true);
    });

    it('throws OTP_EXPIRED when no code is pending', async () => {
      const { otp } = makeOtp();

      await expect(otp.verify('09121234567', '123456')).rejects.toMatchObject({
        code: 'OTP_EXPIRED',
      });
    });

    it('burns the OTP once attempts exceed maxVerifyAttempts', async () => {
      const { otp } = makeOtp({ 'otp.maxVerifyAttempts': 1 });
      const code = await otp.generate('09121234567');
      const wrong = code === '000000' ? '999999' : '000000';

      // Attempt 1 is within the limit
      await expect(otp.verify('09121234567', wrong)).rejects.toMatchObject({
        code: 'OTP_INVALID',
      });
      // Attempt 2 exceeds it — OTP burned
      await expect(otp.verify('09121234567', wrong)).rejects.toMatchObject({
        code: 'OTP_RATE_LIMITED',
      });
      // Code is gone — even the correct one no longer works
      await expect(otp.verify('09121234567', code)).rejects.toMatchObject({
        code: 'OTP_EXPIRED',
      });
    });
  });

  describe('discard', () => {
    it('removes the pending code and its cooldown', async () => {
      const { redis, otp } = makeOtp();

      await otp.generate('09121234567');
      expect(await redis.get('otp:09121234567')).toBeTruthy();

      await otp.discard('09121234567');

      expect(await redis.get('otp:09121234567')).toBeNull();
      expect(await redis.exists('otp:cooldown:09121234567')).toBe(false);
    });
  });

  describe('hashing', () => {
    it('never stores the plain code (different phones can share a code safely)', async () => {
      const { redis, otp } = makeOtp({ 'app.nodeEnv': 'development', 'otp.devCode': '54321' });

      const code = await otp.generate('09121234567');
      expect(code).toBe('54321');
      expect(await redis.get('otp:09121234567')).not.toBe('54321');
    });
  });
});
