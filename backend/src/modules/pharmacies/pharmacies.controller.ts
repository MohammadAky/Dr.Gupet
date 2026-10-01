import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PharmaciesService } from './pharmacies.service';
import { PharmacyQueryDto } from './dto/pharmacy-query.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Pharmacies')
@Controller('pharmacies')
export class PharmaciesController {
  constructor(private pharmaciesService: PharmaciesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List pharmacies' })
  @ApiResponse({ status: 200, description: 'Pharmacies returned' })
  @ApiResponse({ status: 400, description: 'Invalid query (e.g. is24h not true/false)' })
  async findAll(@Query() query: PharmacyQueryDto) {
    return this.pharmaciesService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get pharmacy detail' })
  @ApiResponse({ status: 200, description: 'Pharmacy returned' })
  @ApiResponse({ status: 404, description: 'Pharmacy not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pharmaciesService.findOne(id);
  }
}
