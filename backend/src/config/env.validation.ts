import { plainToInstance } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  PUBLIC_BASE_URL: string;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  REDIS_URL: string;

  @IsString()
  JWT_ACCESS_SECRET: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_ACCESS_TTL: string;

  @IsString()
  JWT_REFRESH_TTL: string;

  @IsNumber()
  OTP_TTL_SECONDS: number;

  @IsNumber()
  OTP_RESEND_COOLDOWN_SECONDS: number;

  @IsNumber()
  OTP_MAX_PER_HOUR: number;

  @IsNumber()
  OTP_MAX_VERIFY_ATTEMPTS: number;

  @IsOptional()
  @IsString()
  OTP_DEV_CODE: string;

  @IsOptional()
  @IsString()
  OTP_HASH_SECRET?: string;

  @IsIn(['console', 'smsir'])
  SMS_DRIVER: string;

  @IsOptional()
  @IsString()
  SMS_API_KEY?: string;

  @IsOptional()
  @IsString()
  SMS_IR_TEMPLATE_ID?: string;

  @IsOptional()
  @IsString()
  SMS_IR_PARAM_NAME?: string;

  @IsOptional()
  @IsString()
  SMS_IR_BASE_URL?: string;

  @IsOptional()
  @IsString()
  SMS_IR_LINE_NUMBER?: string;

  @IsIn(['mock', 'zarinpal', 'disabled'])
  PAYMENT_DRIVER: string;

  @IsOptional()
  @IsString()
  ZARINPAL_MERCHANT_ID?: string;

  @IsOptional()
  @IsString()
  ZARINPAL_API_BASE?: string;

  @IsOptional()
  @IsString()
  ZARINPAL_STARTPAY_BASE?: string;

  @IsOptional()
  @IsString()
  PAYMENT_MOCK_PAY_URL?: string;

  @IsOptional()
  @IsString()
  PAYMENT_CALLBACK_SECRET?: string;

  @IsString()
  PAYMENT_CALLBACK_URL: string;

  @IsString()
  FRONTEND_PAYMENT_RESULT_URL: string;

  @IsString()
  UPLOAD_DIR: string;

  @Min(1)
  @Max(10)
  UPLOAD_MAX_MB: number;

  @IsOptional()
  @IsNumber()
  UPLOAD_DAILY_COUNT_LIMIT?: number;

  @IsOptional()
  @IsNumber()
  UPLOAD_DAILY_BYTES_LIMIT?: number;

  @IsNumber()
  SHIPPING_FLAT_COST: number;

  @IsNumber()
  FREE_SHIPPING_THRESHOLD: number;

  @IsNumber()
  ORDER_EXPIRE_MINUTES: number;

  @IsString()
  ADMIN_SEED_PHONE: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  // Production hardening (issues #01, #04): mock/dev drivers must never reach
  // production, and real provider credentials must be present.
  const nodeEnv = validatedConfig.NODE_ENV;
  if (nodeEnv === Environment.Production) {
    if (!['zarinpal', 'disabled'].includes(validatedConfig.PAYMENT_DRIVER)) {
      throw new Error('PAYMENT_DRIVER must be "zarinpal" or "disabled" in production');
    }
    if (validatedConfig.SMS_DRIVER !== 'smsir') {
      throw new Error('SMS_DRIVER must be "smsir" in production');
    }
    if (!validatedConfig.SMS_API_KEY || !validatedConfig.SMS_IR_TEMPLATE_ID) {
      throw new Error('SMS_API_KEY and SMS_IR_TEMPLATE_ID are required in production');
    }
    if (validatedConfig.PAYMENT_DRIVER === 'zarinpal' && !validatedConfig.ZARINPAL_MERCHANT_ID) {
      throw new Error('ZARINPAL_MERCHANT_ID is required in production');
    }
    if (!validatedConfig.OTP_HASH_SECRET) {
      throw new Error('OTP_HASH_SECRET is required in production (dedicated from JWT secrets)');
    }
  }

  return validatedConfig;
}
