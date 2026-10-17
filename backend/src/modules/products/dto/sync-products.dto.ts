import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SQL_INT_MAX } from './import-products.dto';

export class SyncProductRowDto {
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  productId?: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  variantId?: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  brandId?: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  categoryId?: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  petTypeId?: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  brandName?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  categoryName?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  name?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  sku?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  slug?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(5000)
  ingredientsText?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(5000)
  description?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsBoolean()
  isActive?: boolean;
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(SQL_INT_MAX)
  price?: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(SQL_INT_MAX)
  stock?: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(SQL_INT_MAX)
  weightGram?: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(SQL_INT_MAX)
  compareAtPrice?: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(SQL_INT_MAX)
  expectedStock?: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsISO8601({ strict: true })
  expectedUpdatedAt?: string;
}

export class SyncProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SyncProductRowDto)
  rows: SyncProductRowDto[];
}
