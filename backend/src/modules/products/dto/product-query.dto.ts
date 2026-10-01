import { IsOptional, IsString, IsNumber, IsBoolean, IsIn, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by pet type ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  petTypeId?: number;

  @ApiPropertyOptional({ description: 'Filter by category slug' })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({ description: 'Filter by brand ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  brandId?: number;

  @ApiPropertyOptional({ description: 'Filter by life stage' })
  @IsOptional()
  @IsString()
  lifeStage?: string;

  @ApiPropertyOptional({ description: 'Filter by size class' })
  @IsOptional()
  @IsString()
  sizeClass?: string;

  @ApiPropertyOptional({ description: 'Comma-separated tag IDs' })
  @IsOptional()
  @IsString()
  tagIds?: string;

  @ApiPropertyOptional({ description: 'Minimum price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'In stock only', enum: ['true', 'false'] })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value; // anything else reaches @IsBoolean and is rejected with 400
  })
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ description: 'Sort by', enum: ['newest', 'price_asc', 'price_desc'] })
  @IsOptional()
  @IsString()
  @IsIn(['newest', 'price_asc', 'price_desc'])
  sort?: string;
}
