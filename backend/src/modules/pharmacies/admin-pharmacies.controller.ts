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
import { AdminPharmacyListQueryDto } from '../../admin/dto/admin-query.dto';
import { CreatePharmacyDto, UpdatePharmacyDto } from './dto/admin-pharmacy.dto';

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
  async findAll(@Query() query: AdminPharmacyListQueryDto) {
    return this.pharmaciesService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pharmacy detail with medicine links (admin only)' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pharmaciesService.findOneAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create pharmacy (admin only)' })
  async create(@Body() body: CreatePharmacyDto, @Req() req: any) {
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
    @Body() body: UpdatePharmacyDto,
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
