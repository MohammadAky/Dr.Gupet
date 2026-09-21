import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { AppException } from '../../common/filters/all-exceptions.filter';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private redis: RedisService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate and store OTP in Redis
   * Returns the code (for console driver) or void
   */
  async generate(phone: string): Promise<string> {
    const nodeEnv = this.configService.get<string>('app.nodeEnv');
    const ttl = this.configService.get<number>('otp.ttlSeconds') || 120;
    const cooldown = this.configService.get<number>('otp.resendCooldownSeconds') || 60;
    const maxPerHour = this.configService.get<number>('otp.maxPerHour') || 5;
    const devCode = this.configService.get<string>('otp.devCode');

    // Check cooldown
    const cooldownKey = `otp:cooldown:${phone}`;
    const hasCooldown = await this.redis.exists(cooldownKey);
    if (hasCooldown) {
      throw new AppException('OTP_RATE_LIMITED', 'لطفاً چند لحظه صبر کنید و دوباره تلاش کنید', 429);
    }

    // Check hourly limit
    const countKey = `otp:count:${phone}`;
    const count = await this.redis.incr(countKey);
    if (count === 1) {
      await this.redis.expire(countKey, 3600);
    }
    if (count > maxPerHour) {
      throw new AppException('OTP_RATE_LIMITED', 'تعداد درخواست‌ها از حد مجاز فراتر رفته است', 429);
    }

    // Generate code
    let code: string;
    if (nodeEnv !== 'production' && devCode) {
      code = devCode;
    } else {
      code = crypto.randomInt(100000, 999999).toString();
    }

    // Hash the code before storing
    const hashedCode = this.hashOtp(code);

    // Store hashed OTP
    const otpKey = `otp:${phone}`;
    await this.redis.set(otpKey, hashedCode, ttl);

    // Set cooldown
    await this.redis.set(cooldownKey, '1', cooldown);

    return code;
  }

  /**
   * Verify OTP code
   * Returns true if valid, throws if invalid/expired
   */
  async verify(phone: string, code: string): Promise<boolean> {
    const maxAttempts = this.configService.get<number>('otp.maxVerifyAttempts') || 5;

    const otpKey = `otp:${phone}`;
    const storedHash = await this.redis.get(otpKey);

    if (!storedHash) {
      throw new AppException('OTP_EXPIRED', 'کد تایید منقضی شده یا وجود ندارد', 400);
    }

    // Check attempts
    const attemptsKey = `otp:attempts:${phone}`;
    const attempts = await this.redis.incr(attemptsKey);
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, 3600);
    }

    if (attempts > maxAttempts) {
      // Delete OTP after max attempts
      await this.redis.del(otpKey, attemptsKey);
      throw new AppException('OTP_RATE_LIMITED', 'تعداد تلاش‌ها از حد مجاز فراتر رفته است', 429);
    }

    // Compare hashes with timing-safe comparison
    const hashedInput = this.hashOtp(code);
    const storedBuf = Buffer.from(storedHash);
    const inputBuf = Buffer.from(hashedInput);

    if (storedBuf.length !== inputBuf.length || !crypto.timingSafeEqual(storedBuf, inputBuf)) {
      throw new AppException('OTP_INVALID', 'کد تایید نادرست است', 400);
    }

    // Success — delete all OTP keys for this phone
    await this.redis.del(otpKey, attemptsKey);

    return true;
  }

  private hashOtp(code: string): string {
    const secret = this.configService.get<string>('jwt.accessSecret') || 'default-secret';
    return crypto.createHmac('sha256', secret).update(code).digest('hex');
  }
}