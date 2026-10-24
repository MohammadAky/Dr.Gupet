import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const coordinate = { maxDecimalPlaces: 6 };

/** Runtime DTOs for pharmacy writes (issues #08 and #19), including onDuty. */
export class CreatePharmacyDto {
  @ApiProperty({ example: 'داروخانهٔ شبانه‌روزی مهر' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'خراسان رضوی' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  province: string;

  @ApiProperty({ example: 'مشهد' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'خیابان امام رضا، پلاک ۴' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  address: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  workingHours?: string | null;

  @ApiPropertyOptional({ minimum: -90, maximum: 90 })
  @IsOptional()
  @IsNumber(coordinate)
  @Min(-90)
  @Max(90)
  lat?: number | null;

  @ApiPropertyOptional({ minimum: -180, maximum: 180 })
  @IsOptional()
  @IsNumber(coordinate)
  @Min(-180)
  @Max(180)
  lng?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is24h?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  onDuty?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePharmacyDto extends PartialType(CreatePharmacyDto) {}
