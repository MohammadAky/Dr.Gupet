import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PharmaciesService } from './pharmacies.service';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Pharmacies')
@Controller('pharmacies')
export class PharmaciesController {
  constructor(private pharmaciesService: PharmaciesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List pharmacies' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'province', required: false })
  @ApiQuery({ name: 'is24h', required: false })
  @ApiResponse({ status: 200, description: 'Pharmacies returned' })
  async findAll(@Query() query: PaginationQueryDto & any) {
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