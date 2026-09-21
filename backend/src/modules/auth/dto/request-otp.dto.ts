import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ example: '09123456789' })
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره تلفن معتبر نیست' })
  phone: string;
}