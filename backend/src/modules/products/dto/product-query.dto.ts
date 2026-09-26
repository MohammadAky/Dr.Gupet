import { IsOptional, IsString, IsNumber, IsBoolean, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by name' })
  @IsOptional()
  @IsString()
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

  @ApiPropertyOptional({ description: 'In stock only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ description: 'Sort by', enum: ['newest', 'price_asc', 'price_desc'] })
  @IsOptional()
  @IsString()
  @IsIn(['newest', 'price_asc', 'price_desc'])
  sort?: string;
}