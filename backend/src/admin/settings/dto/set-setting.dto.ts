import { IsString, IsIn, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SETTING_KEYS } from '../settings.service';

export class SetSettingDto {
  @ApiProperty({ example: 'SHIPPING_FLAT_COST', enum: [...SETTING_KEYS] })
  @IsString()
  @IsIn([...SETTING_KEYS])
  key: string;

  @ApiProperty({ example: '50000' })
  @IsString()
  @MinLength(1)
  value: string;
}
