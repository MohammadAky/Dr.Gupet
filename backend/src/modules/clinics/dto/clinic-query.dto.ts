import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Strict query-string boolean: only 'true'/'false' (or a real boolean) accepted. */
export function strictBoolean({ value }: { value: unknown }): unknown {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value; // anything else reaches @IsBoolean and is rejected with 400
}

export class ClinicQueryDto extends PaginationQueryDto {
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

  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'Filter 24-hour clinics' })
  @IsOptional()
  @Transform(strictBoolean)
  @IsBoolean()
  is24h?: boolean;
}
