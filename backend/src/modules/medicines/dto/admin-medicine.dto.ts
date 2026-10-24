import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Same-site uploaded path or an https URL; never a script/data scheme. */
export const MEDICINE_IMAGE = /^(?:|\/uploads\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:webp|png|jpe?g)|https:\/\/[^\s]+)$/;

/** Runtime DTOs for medicine writes (issue #19). */
export class CreateMedicineDto {
  @ApiProperty({ example: 'قرص ضد انگل' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  name: string;

  @ApiPropertyOptional({ maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  activeIngredient?: string | null;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  type?: string | null;

  @ApiPropertyOptional({ maxLength: 191 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(191)
  brand?: string | null;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  usage?: string | null;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresPrescription?: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @Matches(MEDICINE_IMAGE, { message: 'نشانی تصویر دارو معتبر نیست' })
  image?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [Number], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  petTypeIds?: number[];
}

export class UpdateMedicineDto extends PartialType(CreateMedicineDto) {}
