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
import { PetTypesService } from './pet-types.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';

@ApiTags('Admin - Pet types')
@Controller('admin/pet-types')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminPetTypesController {
  constructor(
    private petTypesService: PetTypesService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List pet types incl. inactive (admin only)' })
  async findAll(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.petTypesService.findAllAdmin({
      search,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create pet type (admin only)' })
  async create(@Body() body: { name: string; slug?: string; isActive?: boolean }, @Req() req: any) {
    const petType = await this.petTypesService.create(body);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'CREATE',
      entity: 'PetType',
      entityId: petType.id,
      summary: petType.name,
      ip: req.ip,
    });
    return petType;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update pet type (admin only)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ name: string; isActive: boolean }>,
    @Req() req: any,
  ) {
    const petType = await this.petTypesService.update(id, body);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'PetType',
      entityId: id,
      summary: Object.keys(body).join(','),
      ip: req.ip,
    });
    return petType;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete pet type — deactivates when used (admin only)' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.petTypesService.remove(id);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'DELETE',
      entity: 'PetType',
      entityId: id,
      summary: result.deleted ? 'deleted' : 'deactivated (in use)',
      ip: req.ip,
    });
    return result;
  }
}
