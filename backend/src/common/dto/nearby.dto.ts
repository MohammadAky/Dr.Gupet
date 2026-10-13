import { IsLatitude, IsLongitude, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ClinicQueryDto, strictBoolean } from '../../modules/clinics/dto/clinic-query.dto';

// POST body only: precise user coordinates never enter access-log URLs.
export class NearbyClinicDto extends ClinicQueryDto {
  @ApiProperty({ minimum: -90, maximum: 90 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLatitude()
  lat!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsLongitude()
  lng!: number;
}

export class NearbyPharmacyDto extends NearbyClinicDto {
  @ApiPropertyOptional({ description: 'Filter on-duty pharmacies' })
  @IsOptional()
  @Transform(strictBoolean)
  @IsBoolean()
  onDuty?: boolean;
}
