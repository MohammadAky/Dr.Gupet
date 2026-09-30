import {
  IsString,
  IsIn,
  IsInt,
  IsOptional,
  IsBoolean,
  IsDateString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCouponDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiProperty({ example: 'PERCENT', enum: ['PERCENT', 'FIXED'] })
  @IsString()
  @IsIn(['PERCENT', 'FIXED'])
  type: string;

  @ApiProperty({ example: 20, description: 'درصد برای PERCENT، مبلغ تومان برای FIXED' })
  @IsInt()
  @Min(1)
  value: number;

  @ApiPropertyOptional({ example: 1000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscount?: number;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalLimit?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCouponDto {
  @ApiPropertyOptional({ example: 'PERCENT', enum: ['PERCENT', 'FIXED'] })
  @IsOptional()
  @IsString()
  @IsIn(['PERCENT', 'FIXED'])
  type?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderAmount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  totalLimit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
