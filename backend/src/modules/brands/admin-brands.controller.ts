import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BrandsService } from './brands.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';

@ApiTags('Admin - Brands')
@Controller('admin/brands')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminBrandsController {
  constructor(
    private brandsService: BrandsService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List brands incl. inactive (admin only)' })
  async findAll() {
    return this.brandsService.findAllAdmin();
  }

  @Post()
  @ApiOperation({ summary: 'Create brand (admin only)' })
  async create(
    @Body()
    body: {
      name: string;
      slug?: string;
      logo?: string;
      country?: string;
      description?: string;
      isActive?: boolean;
    },
    @Req() req: any,
  ) {
    const brand = await this.brandsService.create(body);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'CREATE',
      entity: 'Brand',
      entityId: brand.id,
      summary: brand.name,
      ip: req.ip,
    });
    return brand;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update brand (admin only)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Partial<{
      name: string;
      logo: string;
      country: string;
      description: string;
      isActive: boolean;
    }>,
    @Req() req: any,
  ) {
    const brand = await this.brandsService.update(id, body);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'UPDATE',
      entity: 'Brand',
      entityId: id,
      summary: Object.keys(body).join(','),
      ip: req.ip,
    });
    return brand;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete brand — deactivates when it has products (admin only)' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.brandsService.remove(id);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'DELETE',
      entity: 'Brand',
      entityId: id,
      summary: result.deleted ? 'deleted' : 'deactivated (has products)',
      ip: req.ip,
    });
    return result;
  }
}
