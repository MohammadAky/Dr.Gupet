import { IsString, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: '09123456789' })
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره تلفن معتبر نیست' })
  phone: string;

  @ApiProperty({ example: '12345' })
  @IsString()
  @Length(5, 6)
  @Matches(/^\d+$/, { message: 'کد تایید باید عددی باشد' })
  code: string;
}