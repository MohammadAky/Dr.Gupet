import { Controller, Get, Post, Body, HttpCode, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ClinicsService } from './clinics.service';
import { ClinicQueryDto } from './dto/clinic-query.dto';
import { NearbyClinicDto } from '../../common/dto/nearby.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Clinics')
@Controller('clinics')
export class ClinicsController {
  constructor(private clinicsService: ClinicsService) {}

  @Public()
  @Post('nearby')
  @HttpCode(200)
  @ApiOperation({ summary: 'Nearest facilities; permission-based coordinates in body, not URL' })
  async nearby(@Body() query: NearbyClinicDto) {
    return this.clinicsService.nearby(query);
  }

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
