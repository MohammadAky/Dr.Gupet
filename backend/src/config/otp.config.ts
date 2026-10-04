import { registerAs } from '@nestjs/config';

/**
 * OTP policy configuration (phase 1 of the OTP/SMS consolidation).
 *
 * These keys were previously validated in `env.validation` but never mapped
 * into a config namespace — `configService.get('otp.*')` always returned
 * undefined and the services silently fell back to hardcoded defaults.
 * This namespace makes every OTP_* env var actually effective.
 */
export default registerAs('otp', () => ({
  ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '120', 10),
  resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
  maxPerHour: parseInt(process.env.OTP_MAX_PER_HOUR || '5', 10),
  maxVerifyAttempts: parseInt(process.env.OTP_MAX_VERIFY_ATTEMPTS || '5', 10),
  devCode: process.env.OTP_DEV_CODE,
  /**
   * Dedicated secret for hashing OTP codes in Redis. Kept separate from the
   * JWT secrets so rotating access/refresh tokens never invalidates in-flight
   * OTPs (and vice versa). Required in production.
   */
  hashSecret: process.env.OTP_HASH_SECRET,
}));
