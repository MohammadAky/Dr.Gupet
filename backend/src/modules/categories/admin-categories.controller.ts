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
import { CategoriesService } from './categories.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';

@ApiTags('Admin - Categories')
@Controller('admin/categories')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminCategoriesController {
  constructor(
    private categoriesService: CategoriesService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Flat list of categories incl. inactive (admin only)' })
  async findAll(@Query('petTypeId') petTypeId?: string) {
    return this.categoriesService.findAllAdmin(petTypeId ? Number(petTypeId) : undefined);
  }

  @Post()
  @ApiOperation({ summary: 'Create category (admin only)' })
  async create(
    @Body()
    body: {
      name: string;
      slug?: string;
      petTypeId?: number;
      parentId?: number;
      image?: string;
      isActive?: boolean;
    },
    @Req() req: any,
  ) {
    const category = await this.categoriesService.create(body);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'CREATE',
      entity: 'ProductCategory',
      entityId: category.id,
      summary: category.name,
      ip: req.ip,
    });
    return category;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update category (admin only)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Partial<{
      name: string;
      petTypeId: number;
      parentId: number;
      image: string;
      isActive: boolean;
    }>,
    @Req() req: any,
  ) {
    const category = await this.categoriesService.update(id, body);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'ProductCategory',
      entityId: id,
      summary: Object.keys(body).join(','),
      ip: req.ip,
    });
    return category;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete category — deactivates when used (admin only)' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.categoriesService.remove(id);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'DELETE',
      entity: 'ProductCategory',
      entityId: id,
      summary: result.deleted ? 'deleted' : 'deactivated (in use)',
      ip: req.ip,
    });
    return result;
  }
}
