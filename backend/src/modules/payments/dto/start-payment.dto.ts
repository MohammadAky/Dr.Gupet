import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartPaymentDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  orderId: number;
}