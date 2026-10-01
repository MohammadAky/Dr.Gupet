import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ClinicsService } from './clinics.service';
import { ClinicQueryDto } from './dto/clinic-query.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Clinics')
@Controller('clinics')
export class ClinicsController {
  constructor(private clinicsService: ClinicsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List clinics' })
  @ApiResponse({ status: 200, description: 'Clinics returned' })
  @ApiResponse({ status: 400, description: 'Invalid query (e.g. is24h not true/false)' })
  async findAll(@Query() query: ClinicQueryDto) {
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
