import { IsString, IsOptional, IsNumber, IsBoolean, IsIn, IsDateString, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePetDto {
  @ApiProperty({ example: 'دوست من' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  petTypeId: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  breedId?: number;

  @ApiPropertyOptional({ example: '2023-01-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE'] })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE'])
  gender?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isNeutered?: boolean;

  @ApiPropertyOptional({ example: 5.5 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(200)
  weightKg?: number;

  @ApiPropertyOptional({ example: 'http://localhost:3000/uploads/pet.jpg' })
  @IsOptional()
  @IsString()
  photo?: string;
}