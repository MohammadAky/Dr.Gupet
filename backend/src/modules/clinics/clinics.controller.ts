import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ClinicsService } from './clinics.service';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Clinics')
@Controller('clinics')
export class ClinicsController {
  constructor(private clinicsService: ClinicsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List clinics' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city' })
  @ApiQuery({ name: 'province', required: false, description: 'Filter by province' })
  @ApiQuery({ name: 'is24h', required: false, description: 'Filter 24-hour clinics' })
  @ApiResponse({ status: 200, description: 'Clinics returned' })
  async findAll(@Query() query: PaginationQueryDto & any) {
    return this.clinicsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get clinic detail' })
  @ApiResponse({ status: 200, description: 'Clinic returned' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clinicsService.findOne(id);
  }
}
