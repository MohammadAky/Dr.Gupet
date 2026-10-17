import { IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELED',
] as const;

export class TransitionOrderDto {
  @ApiProperty({ example: 'PROCESSING', enum: ['PROCESSING', 'SHIPPED', 'DELIVERED'] })
  @IsString()
  @IsIn(['PROCESSING', 'SHIPPED', 'DELIVERED'])
  to: string;

  @ApiPropertyOptional({
    enum: ORDER_STATUSES,
    description: 'Reject if the current order status has changed',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsIn(ORDER_STATUSES)
  expectedStatus?: string;

  @ApiPropertyOptional({ example: 'IR1234567890' })
  @IsOptional()
  @IsString()
  trackingCode?: string;

  @ApiPropertyOptional({ example: 'پست پیشتاز' })
  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @ApiPropertyOptional({ example: 'بسته‌بندی شد' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SetTrackingDto {
  @ApiProperty({ example: 'IR1234567890' })
  @IsString()
  @MinLength(1)
  trackingCode: string;

  @ApiPropertyOptional({ example: 'پست پیشتاز' })
  @IsOptional()
  @IsString()
  shippingMethod?: string;
}

export class CancelOrderDto {
  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsIn(ORDER_STATUSES)
  expectedStatus?: string;

  @ApiPropertyOptional({ example: 'درخواست مشتری' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RefundOrderDto {
  @ApiProperty({ example: 'استرداد وجه به حساب مشتری انجام شد' })
  @IsString()
  @MinLength(1)
  refundNote: string;
}
