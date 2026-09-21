import { IsString, IsOptional, MaxLength, IsPhoneNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiProperty({ example: 'خانه' })
  @IsString()
  @MaxLength(50)
  title: string;

  @ApiProperty({ example: 'علی رضایی' })
  @IsString()
  @MaxLength(100)
  receiverName: string;

  @ApiProperty({ example: '09123456789' })
  @IsString()
  receiverPhone: string;

  @ApiProperty({ example: 'تهران' })
  @IsString()
  @MaxLength(50)
  province: string;

  @ApiProperty({ example: 'تهران' })
  @IsString()
  @MaxLength(50)
  city: string;

  @ApiProperty({ example: 'خیابان ولیعصر، پلاک ۱۲۳' })
  @IsString()
  @MaxLength(500)
  fullAddress: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @ApiPropertyOptional({ example: 35.6892 })
  @IsOptional()
  lat?: number;

  @ApiPropertyOptional({ example: 51.3890 })
  @IsOptional()
  lng?: number;
}