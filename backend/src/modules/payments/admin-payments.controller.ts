import { Controller, Get, Post, Param, Query, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminPaymentsService } from './admin-payments.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Admin - Payments')
@Controller('admin/payments')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminPaymentsController {
  constructor(
    private adminPaymentsService: AdminPaymentsService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all payments with filters (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated payments' })
  async findAll(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: string,
    @Query('gateway') gateway?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminPaymentsService.findAllAdmin({ ...query, status, gateway, from, to });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Payment detail (admin only)' })
  @ApiResponse({ status: 200, description: 'Payment detail' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminPaymentsService.findOneAdmin(id);
  }

  @Post(':id/reconcile')
  @ApiOperation({ summary: 'Re-run gateway verify for a payment (admin only)' })
  @ApiResponse({ status: 200, description: 'Reconcile result' })
  async reconcile(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.adminPaymentsService.reconcile(id);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'Payment',
      entityId: id,
      summary: 'reconcile',
      ip: req.ip,
    });
    return result;
  }

  @Post(':id/mark-failed')
  @ApiOperation({ summary: 'Manually mark a payment as failed (admin only)' })
  @ApiResponse({ status: 200, description: 'Payment marked failed' })
  @ApiResponse({ status: 409, description: 'Successful payments cannot be failed' })
  async markFailed(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const payment = await this.adminPaymentsService.markFailed(id);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'Payment',
      entityId: id,
      summary: 'mark failed',
      ip: req.ip,
    });
    return payment;
  }
}
