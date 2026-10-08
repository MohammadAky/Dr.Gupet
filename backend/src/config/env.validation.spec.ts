import 'reflect-metadata';
import { validate } from './env.validation';

function productionConfig(driver = 'disabled') {
  return {
    NODE_ENV: 'production',
    PORT: 3000,
    PUBLIC_BASE_URL: 'https://example.test',
    DATABASE_URL: 'mysql://test:test@localhost/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
    OTP_TTL_SECONDS: 120,
    OTP_RESEND_COOLDOWN_SECONDS: 60,
    OTP_MAX_PER_HOUR: 5,
    OTP_MAX_VERIFY_ATTEMPTS: 5,
    OTP_HASH_SECRET: 'test-otp-secret',
    SMS_DRIVER: 'smsir',
    SMS_API_KEY: 'test-api-key',
    SMS_IR_TEMPLATE_ID: '123',
    PAYMENT_DRIVER: driver,
    PAYMENT_CALLBACK_URL: 'https://example.test/api/v1/payments/callback',
    FRONTEND_PAYMENT_RESULT_URL: 'https://example.test/payment/result',
    UPLOAD_DIR: './uploads',
    UPLOAD_MAX_MB: 5,
    SHIPPING_FLAT_COST: 50000,
    FREE_SHIPPING_THRESHOLD: 1500000,
    ORDER_EXPIRE_MINUTES: 30,
    ADMIN_SEED_PHONE: '09000000000',
  };
}

describe('Production without an enabled payment provider', () => {
  it('permits explicit disabled payments without a merchant', () => {
    expect(validate(productionConfig()).PAYMENT_DRIVER).toBe('disabled');
  });
  it('still rejects mock payments in production', () => {
    expect(() => validate(productionConfig('mock'))).toThrow('PAYMENT_DRIVER');
  });
  it('still requires a merchant for zarinpal', () => {
    expect(() => validate(productionConfig('zarinpal'))).toThrow('ZARINPAL_MERCHANT_ID');
  });
  it('still requires real SMS credentials and an independent OTP hash secret', () => {
    expect(() => validate({ ...productionConfig(), SMS_API_KEY: '' })).toThrow('SMS_API_KEY');
    expect(() => validate({ ...productionConfig(), SMS_DRIVER: 'console' })).toThrow('SMS_DRIVER');
    expect(() => validate({ ...productionConfig(), OTP_HASH_SECRET: '' })).toThrow(
      'OTP_HASH_SECRET',
    );
  });
});
