import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { BreedsService } from './breeds.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Breeds')
@Controller('breeds')
export class BreedsController {
  constructor(private breedsService: BreedsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all active breeds' })
  @ApiQuery({ name: 'petTypeId', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Breeds returned' })
  async findAll(@Query('petTypeId') petTypeId?: number) {
    return this.breedsService.findAll(petTypeId ? Number(petTypeId) : undefined);
  }
}