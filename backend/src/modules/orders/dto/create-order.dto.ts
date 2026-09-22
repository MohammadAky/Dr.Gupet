import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  addressId: number;

  @ApiPropertyOptional({ example: 'SUMMER20' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ example: 'لطفاً با دقت بسته‌بندی شود' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}