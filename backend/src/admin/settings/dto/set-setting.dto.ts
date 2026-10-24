import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SETTING_KEYS } from '../settings.service';

/**
 * Only the documented operational keys are writable, and only as a plain
 * non-negative integer string (issue #17). Range rules per key live in
 * SettingsService so direct service callers get the same contract.
 */
export class SetSettingDto {
  @ApiProperty({ example: 'SHIPPING_FLAT_COST', enum: [...SETTING_KEYS] })
  @IsString()
  @IsIn([...SETTING_KEYS])
  key: string;

  @ApiProperty({ example: '50000' })
  @IsString()
  @Matches(/^\d{1,10}$/, { message: 'مقدار تنظیمات باید عدد صحیح نامنفی باشد' })
  @MaxLength(10)
  value: string;
}
