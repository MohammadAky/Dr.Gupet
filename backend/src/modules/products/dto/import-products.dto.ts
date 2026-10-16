import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { normalizeFa } from '../../../common/utils/normalize-fa.util';

export const SQL_INT_MAX = 2147483647;

export class ImportProductRowDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  brandId?: number;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeFa(value).trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  brandName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  categoryId?: number;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeFa(value).trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  categoryName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  petTypeId?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(191)
  name: string;

  @IsInt()
  @Min(0)
  @Max(SQL_INT_MAX)
  price: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(SQL_INT_MAX)
  stock?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(SQL_INT_MAX)
  weightGram?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(SQL_INT_MAX)
  compareAtPrice?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(191)
  sku?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(191)
  slug?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  ingredientsText?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class ImportProductsDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  brandId?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  categoryId?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  petTypeId?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImportProductRowDto)
  rows: ImportProductRowDto[];
}
