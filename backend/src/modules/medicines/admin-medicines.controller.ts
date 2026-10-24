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
import { MedicinesService } from './medicines.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';
import { AdminMedicineListQueryDto } from '../../admin/dto/admin-query.dto';
import { CreateMedicineDto, UpdateMedicineDto } from './dto/admin-medicine.dto';

@ApiTags('Admin - Medicines')
@Controller('admin/medicines')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminMedicinesController {
  constructor(
    private medicinesService: MedicinesService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List medicines incl. inactive (admin only)' })
  async findAll(@Query() query: AdminMedicineListQueryDto) {
    return this.medicinesService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Medicine detail with pharmacy links (admin only)' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.medicinesService.findOneAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create medicine (admin only)' })
  async create(@Body() body: CreateMedicineDto, @Req() req: any) {
    const medicine = await this.medicinesService.create(body);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'CREATE',
      entity: 'Medicine',
      entityId: medicine.id,
      summary: medicine.name,
      ip: req.ip,
    });
    return medicine;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update medicine (admin only)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateMedicineDto,
    @Req() req: any,
  ) {
    const medicine = await this.medicinesService.update(id, body);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'Medicine',
      entityId: id,
      summary: Object.keys(body).join(','),
      ip: req.ip,
    });
    return medicine;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete medicine (admin only)' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.medicinesService.remove(id);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'DELETE',
      entity: 'Medicine',
      entityId: id,
      summary: 'deleted',
      ip: req.ip,
    });
    return result;
  }
}
