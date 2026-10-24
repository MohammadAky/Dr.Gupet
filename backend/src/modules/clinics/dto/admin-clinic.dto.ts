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

/** Trim plain text before length validation; numbers/booleans pass through. */
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const coordinate = { maxDecimalPlaces: 6 };

/**
 * Real runtime DTOs for the care directories (issue #19): the global
 * ValidationPipe can only apply whitelist/forbidNonWhitelisted/type checks when
 * the body has a class metatype, so inline TypeScript object types are not a
 * contract. `null` coordinates are what the admin form sends for an empty pair.
 */
export class CreateClinicDto {
  @ApiProperty({ example: 'کلینیک دامپزشکی مهر' })
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

  @ApiProperty({ example: 'بلوار وکیل‌آباد، پلاک ۱۲' })
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

  @ApiPropertyOptional({ example: 36.297, minimum: -90, maximum: 90 })
  @IsOptional()
  @IsNumber(coordinate)
  @Min(-90)
  @Max(90)
  lat?: number | null;

  @ApiPropertyOptional({ example: 59.606, minimum: -180, maximum: 180 })
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
  isVerified?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateClinicDto extends PartialType(CreateClinicDto) {}
