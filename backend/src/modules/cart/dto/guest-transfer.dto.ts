import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_CART_ITEM_QTY } from '../../../common/constants';

export class GuestTransferRowDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  variantId: number;

  @ApiProperty({ minimum: 1, maximum: MAX_CART_ITEM_QTY })
  @IsInt()
  @Min(1)
  @Max(MAX_CART_ITEM_QTY)
  quantity: number;
}

/**
 * Issue #38 — the guest cart is a list of (variantId, quantity) only. Titles,
 * prices and totals from the browser are never accepted: the server re-reads
 * availability, stock and price when it builds the cart view.
 */
export class GuestTransferDto {
  @ApiProperty({ description: 'Stable random retry key, 16–64 chars' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,64}$/, { message: 'شناسه درخواست معتبر نیست' })
  requestId: string;

  @ApiProperty({ type: [GuestTransferRowDto], maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GuestTransferRowDto)
  rows: GuestTransferRowDto[];

  @ApiPropertyOptional({ enum: ['replace'], default: 'replace' })
  @IsOptional()
  @IsIn(['replace'])
  overlapPolicy?: 'replace';

  @ApiPropertyOptional({ description: 'ISO timestamp of the cart the guest saw' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/, {
    message: 'نسخهٔ سبد معتبر نیست',
  })
  expectedCartVersion?: string;
}
