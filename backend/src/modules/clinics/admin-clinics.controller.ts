import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClinicsService } from './clinics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Admin - Clinics')
@Controller('admin/clinics')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminClinicsController {
  constructor(
    private clinicsService: ClinicsService,
    private auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new clinic (admin only)' })
  @ApiResponse({ status: 201, description: 'Clinic created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(
    @Body()
    body: {
      name: string;
      province: string;
      city: string;
      address: string;
      lat?: number;
      lng?: number;
      phone?: string;
      workingHours?: string;
      is24h?: boolean;
    },
    @Req() req: any,
  ) {
    const clinic = await this.clinicsService.create(body);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'CREATE',
      entity: 'Clinic',
      entityId: clinic.id,
      summary: clinic.name,
      ip: req.ip,
    });
    return clinic;
  }

  @Get()
  @ApiOperation({ summary: 'List all clinics for admin (including inactive)' })
  @ApiResponse({ status: 200, description: 'Paginated clinics' })
  async findAllAdmin(
    @Query() query: PaginationQueryDto,
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('province') province?: string,
    @Query('isActive') isActive?: string,
    @Query('isVerified') isVerified?: string,
  ) {
    return this.clinicsService.findAllAdmin({
      ...query,
      q,
      city,
      province,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      isVerified: isVerified === undefined ? undefined : isVerified === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get clinic detail for admin (including inactive)' })
  @ApiResponse({ status: 200, description: 'Clinic returned' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async findOneAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.clinicsService.findOneAdmin(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update clinic (admin only)' })
  @ApiResponse({ status: 200, description: 'Clinic updated' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Partial<{
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
    }>,
    @Req() req: any,
  ) {
    const clinic = await this.clinicsService.update(id, body);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'UPDATE',
      entity: 'Clinic',
      entityId: id,
      summary: Object.keys(body).join(','),
      ip: req.ip,
    });
    return clinic;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete clinic (admin only)' })
  @ApiResponse({ status: 200, description: 'Clinic deleted' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async delete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const clinic = await this.clinicsService.delete(id);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'DELETE',
      entity: 'Clinic',
      entityId: id,
      summary: clinic.name,
      ip: req.ip,
    });
    return clinic;
  }
}
