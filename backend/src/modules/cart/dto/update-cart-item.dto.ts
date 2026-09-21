import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MAX_CART_ITEM_QTY } from '../../../common/constants';

export class UpdateCartItemDto {
  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  @Max(MAX_CART_ITEM_QTY)
  quantity: number;
}