import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MedicinesService } from './medicines.service';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Medicines')
@Controller('medicines')
export class MedicinesController {
  constructor(private medicinesService: MedicinesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List medicines' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'petTypeId', required: false })
  @ApiQuery({ name: 'requiresPrescription', required: false })
  @ApiResponse({ status: 200, description: 'Medicines returned' })
  async findAll(@Query() query: PaginationQueryDto & any) {
    return this.medicinesService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get medicine detail with pharmacies' })
  @ApiQuery({ name: 'city', required: false })
  @ApiResponse({ status: 200, description: 'Medicine returned' })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('city') city?: string,
  ) {
    return this.medicinesService.findOne(id, city);
  }
}