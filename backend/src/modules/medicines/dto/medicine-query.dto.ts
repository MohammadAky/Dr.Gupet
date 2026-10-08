import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { strictBoolean } from '../../clinics/dto/clinic-query.dto';

export class MedicineQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by name or active ingredient', maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by pet type ID', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  petTypeId?: number;

  @ApiPropertyOptional({
    description: 'Filter by prescription requirement',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @Transform(strictBoolean)
  @IsBoolean()
  requiresPrescription?: boolean;
}
