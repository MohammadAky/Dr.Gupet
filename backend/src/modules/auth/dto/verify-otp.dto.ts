import { IsString, Matches, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { normalizePhoneOrKeep } from './request-otp.dto';

export class VerifyOtpDto {
  @ApiProperty({ example: '09123456789' })
  @Transform(normalizePhoneOrKeep)
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره تلفن معتبر نیست' })
  phone: string;

  @ApiProperty({ example: '12345' })
  @IsString()
  @Length(5, 6)
  @Matches(/^\d+$/, { message: 'کد تایید باید عددی باشد' })
  code: string;
}
