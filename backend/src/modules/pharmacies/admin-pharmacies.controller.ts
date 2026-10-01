import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PharmaciesService } from './pharmacies.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Admin - Pharmacies')
@Controller('admin/pharmacies')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminPharmaciesController {
  constructor(
    private pharmaciesService: PharmaciesService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List pharmacies incl. inactive (admin only)' })
  async findAll(
    @Query() query: PaginationQueryDto,
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('province') province?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.pharmaciesService.findAllAdmin({
      ...query,
      q,
      city,
      province,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pharmacy detail with medicine links (admin only)' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pharmaciesService.findOneAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create pharmacy (admin only)' })
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
      isVerified?: boolean;
      isActive?: boolean;
    },
    @Req() req: any,
  ) {
    const pharmacy = await this.pharmaciesService.create(body);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'CREATE',
      entity: 'Pharmacy',
      entityId: pharmacy.id,
      summary: pharmacy.name,
      ip: req.ip,
    });
    return pharmacy;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update pharmacy (admin only)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Partial<{
      name: string;
      province: string;
      city: string;
      address: string;
      lat: number;
      lng: number;
      phone: string;
      workingHours: string;
      is24h: boolean;
      isVerified: boolean;
      isActive: boolean;
    }>,
    @Req() req: any,
  ) {
    const pharmacy = await this.pharmaciesService.update(id, body);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'Pharmacy',
      entityId: id,
      summary: Object.keys(body).join(','),
      ip: req.ip,
    });
    return pharmacy;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete pharmacy (admin only)' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.pharmaciesService.remove(id);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'DELETE',
      entity: 'Pharmacy',
      entityId: id,
      summary: 'deleted',
      ip: req.ip,
    });
    return result;
  }

  // ---- Medicine links ----

  @Post(':id/medicines/:medicineId')
  @ApiOperation({ summary: 'Link medicine to pharmacy and refresh lastConfirmedAt (admin only)' })
  async linkMedicine(
    @Param('id', ParseIntPipe) id: number,
    @Param('medicineId', ParseIntPipe) medicineId: number,
    @Body() body: { note?: string },
    @Req() req: any,
  ) {
    const link = await this.pharmaciesService.linkMedicine(id, medicineId, body?.note);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'PharmacyMedicine',
      entityId: `${id}-${medicineId}`,
      summary: 'link medicine',
      ip: req.ip,
    });
    return link;
  }

  @Delete(':id/medicines/:medicineId')
  @ApiOperation({ summary: 'Unlink medicine from pharmacy (admin only)' })
  async unlinkMedicine(
    @Param('id', ParseIntPipe) id: number,
    @Param('medicineId', ParseIntPipe) medicineId: number,
    @Req() req: any,
  ) {
    const result = await this.pharmaciesService.unlinkMedicine(id, medicineId);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'DELETE',
      entity: 'PharmacyMedicine',
      entityId: `${id}-${medicineId}`,
      summary: 'unlink medicine',
      ip: req.ip,
    });
    return result;
  }
}
