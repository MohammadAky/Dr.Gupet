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
import { BreedsService } from './breeds.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';

@ApiTags('Admin - Breeds')
@Controller('admin/breeds')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminBreedsController {
  constructor(
    private breedsService: BreedsService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List breeds incl. inactive (admin only)' })
  async findAll(@Query('petTypeId') petTypeId?: string) {
    return this.breedsService.findAllAdmin(petTypeId ? Number(petTypeId) : undefined);
  }

  @Post()
  @ApiOperation({ summary: 'Create breed (admin only)' })
  async create(
    @Body() body: { name: string; petTypeId: number; isActive?: boolean },
    @Req() req: any,
  ) {
    const breed = await this.breedsService.create(body);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'CREATE',
      entity: 'Breed',
      entityId: breed.id,
      summary: breed.name,
      ip: req.ip,
    });
    return breed;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update breed (admin only)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ name: string; isActive: boolean }>,
    @Req() req: any,
  ) {
    const breed = await this.breedsService.update(id, body);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'UPDATE',
      entity: 'Breed',
      entityId: id,
      summary: Object.keys(body).join(','),
      ip: req.ip,
    });
    return breed;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete breed — deactivates when pets use it (admin only)' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.breedsService.remove(id);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'DELETE',
      entity: 'Breed',
      entityId: id,
      summary: result.deleted ? 'deleted' : 'deactivated (in use)',
      ip: req.ip,
    });
    return result;
  }
}
