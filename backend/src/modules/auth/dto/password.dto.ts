import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { normalizeUsername, USERNAME_PATTERN, validPassword } from '../password-policy';
import { normalizePhoneOrKeep } from './request-otp.dto';

@ValidatorConstraint({ name: 'passwordPolicy', async: false })
export class PasswordPolicy implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return validPassword(value);
  }
  defaultMessage(): string {
    return 'رمز عبور باید حداقل ۱۲ کاراکتر و حداکثر ۷۲ بایت باشد';
  }
}

export class PasswordLoginDto {
  @Transform(({ value }: { value: unknown }) => normalizeUsername(value))
  @IsString()
  @Matches(USERNAME_PATTERN, { message: 'نام کاربری معتبر نیست' })
  username: string;

  @IsString()
  @MaxLength(72)
  password: string;
}

export class PasswordCredentialDto extends PasswordLoginDto {
  @Validate(PasswordPolicy)
  password: string;
}

export class PasswordRegisterDto extends PasswordCredentialDto {
  @Transform(normalizePhoneOrKeep)
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;

  @IsString()
  @Length(5, 6)
  @Matches(/^\d+$/, { message: 'کد تأیید معتبر نیست' })
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;
}

export class AdminPasswordRegisterDto extends PasswordCredentialDto {
  @Transform(normalizePhoneOrKeep)
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';
}

export class PasswordChangeDto {
  @IsString()
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @Validate(PasswordPolicy)
  newPassword: string;
}

export class PasswordForgotDto {
  @Transform(({ value }: { value: unknown }) => normalizeUsername(value))
  @IsString()
  @Matches(USERNAME_PATTERN, { message: 'نام کاربری معتبر نیست' })
  username: string;

  @Transform(normalizePhoneOrKeep)
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone: string;
}

export class PasswordResetDto extends PasswordForgotDto {
  @IsString()
  @Length(5, 6)
  @Matches(/^\d+$/, { message: 'کد تأیید معتبر نیست' })
  code: string;

  @IsString()
  @Validate(PasswordPolicy)
  newPassword: string;
}
