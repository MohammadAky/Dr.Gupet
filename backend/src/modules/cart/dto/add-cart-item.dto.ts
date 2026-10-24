import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_CART_ITEM_QTY } from '../../../common/constants';

export class AddCartItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  variantId: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CART_ITEM_QTY)
  quantity?: number = 1;
}
