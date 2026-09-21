import { IsArray, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPetTagsDto {
  @ApiProperty({ example: [1, 3, 5], description: 'Allergen tag IDs' })
  @IsArray()
  @IsNumber({}, { each: true })
  allergenTagIds: number[];

  @ApiProperty({ example: [2, 4, 6], description: 'Diet tag IDs' })
  @IsArray()
  @IsNumber({}, { each: true })
  dietTagIds: number[];
}