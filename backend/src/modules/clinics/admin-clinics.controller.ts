import { Controller, Post, Get, Patch, Delete, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClinicsService } from './clinics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Admin - Clinics')
@Controller('admin/clinics')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminClinicsController {
  constructor(private clinicsService: ClinicsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new clinic (admin only)' })
  @ApiResponse({ status: 201, description: 'Clinic created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Body() body: {
    name: string;
    province: string;
    city: string;
    address: string;
    lat?: number;
    lng?: number;
    phone?: string;
    workingHours?: string;
    is24h?: boolean;
  }) {
    return this.clinicsService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'List all clinics for admin (including inactive)' })
  @ApiResponse({ status: 200, description: 'All clinics returned' })
  async findAllAdmin() {
    return this.clinicsService.findAll({ page: 1, limit: 100 });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get clinic detail for admin' })
  @ApiResponse({ status: 200, description: 'Clinic returned' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async findOneAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.clinicsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update clinic (admin only)' })
  @ApiResponse({ status: 200, description: 'Clinic updated' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<{
    name: string;
    province: string;
    city: string;
    address: string;
    lat?: number;
    lng?: number;
    phone?: string;
    workingHours?: string;
    is24h?: boolean;
    isVerified?: boolean;
    isActive?: boolean;
  }>) {
    return this.clinicsService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete clinic (admin only)' })
  @ApiResponse({ status: 200, description: 'Clinic deleted' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.clinicsService.delete(id);
  }
}