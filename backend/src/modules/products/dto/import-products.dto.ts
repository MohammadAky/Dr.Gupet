import { Type } from 'class-transformer';
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

export const SQL_INT_MAX = 2147483647;

export class ImportProductRowDto {
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
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  brandId: number;

  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  categoryId: number;

  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  petTypeId: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImportProductRowDto)
  rows: ImportProductRowDto[];
}
