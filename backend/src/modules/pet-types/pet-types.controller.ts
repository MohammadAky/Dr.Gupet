import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PetTypesService } from './pet-types.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Pet Types')
@Controller('pet-types')
export class PetTypesController {
  constructor(private petTypesService: PetTypesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all active pet types' })
  @ApiResponse({ status: 200, description: 'Pet types returned' })
  async findAll() {
    return this.petTypesService.findAll();
  }

  @Public()
  @Get(':id/breeds')
  @ApiOperation({ summary: 'Get breeds for a pet type' })
  @ApiResponse({ status: 200, description: 'Breeds returned' })
  async findBreeds(@Param('id', ParseIntPipe) id: number) {
    return this.petTypesService.findBreeds(id);
  }
}