import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { strictBoolean } from '../../clinics/dto/clinic-query.dto';

export class PharmacyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 100, description: 'Search by name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ maxLength: 100, description: 'Filter by city' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ maxLength: 100, description: 'Filter by province' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'Filter 24-hour pharmacies' })
  @IsOptional()
  @Transform(strictBoolean)
  @IsBoolean()
  is24h?: boolean;

  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'Filter on-duty pharmacies' })
  @IsOptional()
  @Transform(strictBoolean)
  @IsBoolean()
  onDuty?: boolean;
}
