import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, validateSync } from 'class-validator';

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

  @IsString()
  OTP_DEV_CODE: string;

  @IsString()
  SMS_DRIVER: string;

  @IsString()
  PAYMENT_DRIVER: string;

  @IsString()
  PAYMENT_CALLBACK_URL: string;

  @IsString()
  FRONTEND_PAYMENT_RESULT_URL: string;

  @IsString()
  UPLOAD_DIR: string;

  @IsNumber()
  UPLOAD_MAX_MB: number;

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

  return validatedConfig;
}
