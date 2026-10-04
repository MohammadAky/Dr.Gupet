import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { normalizePhone } from '../../../common/utils/phone.util';

/** Normalize to 09xxxxxxxxx first (accepts +98/98/9…); invalid input keeps its
 *  raw value and fails the @Matches validation below. */
export function normalizePhoneOrKeep({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return normalizePhone(value) ?? value;
}

export class RequestOtpDto {
  @ApiProperty({ example: '09123456789' })
  @Transform(normalizePhoneOrKeep)
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره تلفن معتبر نیست' })
  phone: string;
}
