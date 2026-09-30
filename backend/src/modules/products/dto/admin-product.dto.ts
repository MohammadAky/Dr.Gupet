import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'غذای خشک سگ بالغ رویال کنین' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'royal-canin-adult-dog' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  brandId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  categoryId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  petTypeId: number;

  @ApiPropertyOptional({ example: 'ADULT', enum: ['PUPPY_KITTEN', 'ADULT', 'SENIOR', 'ALL'] })
  @IsOptional()
  @IsString()
  @IsIn(['PUPPY_KITTEN', 'ADULT', 'SENIOR', 'ALL'])
  lifeStage?: string;

  @ApiPropertyOptional({ example: 'MEDIUM', enum: ['SMALL', 'MEDIUM', 'LARGE', 'ALL'] })
  @IsOptional()
  @IsString()
  @IsIn(['SMALL', 'MEDIUM', 'LARGE', 'ALL'])
  sizeClass?: string;

  @ApiPropertyOptional({ example: 'ANY', enum: ['ANY', 'NEUTERED_ONLY'] })
  @IsOptional()
  @IsString()
  @IsIn(['ANY', 'NEUTERED_ONLY'])
  neuterSuitability?: string;

  @ApiPropertyOptional({ example: 'مرغ، برنج، ذرت' })
  @IsOptional()
  @IsString()
  ingredientsText?: string;

  @ApiPropertyOptional({ example: 'توضیح محصول' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  brandId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  petTypeId?: number;

  @ApiPropertyOptional({ enum: ['PUPPY_KITTEN', 'ADULT', 'SENIOR', 'ALL'] })
  @IsOptional()
  @IsString()
  @IsIn(['PUPPY_KITTEN', 'ADULT', 'SENIOR', 'ALL'])
  lifeStage?: string;

  @ApiPropertyOptional({ enum: ['SMALL', 'MEDIUM', 'LARGE', 'ALL'] })
  @IsOptional()
  @IsString()
  @IsIn(['SMALL', 'MEDIUM', 'LARGE', 'ALL'])
  sizeClass?: string;

  @ApiPropertyOptional({ enum: ['ANY', 'NEUTERED_ONLY'] })
  @IsOptional()
  @IsString()
  @IsIn(['ANY', 'NEUTERED_ONLY'])
  neuterSuitability?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ingredientsText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateVariantDto {
  @ApiProperty({ example: 'RC-ADULT-2KG' })
  @IsString()
  @MinLength(1)
  sku: string;

  @ApiProperty({ example: 2000 })
  @IsInt()
  @Min(1)
  weightGram: number;

  @ApiProperty({ example: 1250000 })
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 1400000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  weightGram?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  compareAtPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddProductImageDto {
  @ApiProperty({ example: '/uploads/product-1.webp' })
  @IsString()
  @MinLength(1)
  url: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class SetProductTagsDto {
  @ApiPropertyOptional({ example: [1, 2], description: 'تگ‌های ALLERGEN با kind=CONTAINS' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  contains?: number[];

  @ApiPropertyOptional({ example: [3], description: 'تگ‌های DIET با kind=SUITABLE_FOR' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  suitableFor?: number[];
}
