import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Admin - Audit')
@Controller('admin/audit-logs')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List admin audit logs (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated audit logs' })
  async findAll(
    @Query() query: PaginationQueryDto,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('adminId') adminId?: string,
  ) {
    return this.auditService.findAll({
      ...query,
      entity,
      action,
      adminId: adminId ? Number(adminId) : undefined,
    });
  }
}
