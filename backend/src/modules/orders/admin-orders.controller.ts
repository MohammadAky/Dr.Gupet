import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminOrdersService } from './admin-orders.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';
import { AdminOrderListQueryDto } from '../../admin/dto/admin-query.dto';
import {
  TransitionOrderDto,
  SetTrackingDto,
  CancelOrderDto,
  RefundOrderDto,
} from './dto/admin-order.dto';

@ApiTags('Admin - Orders')
@Controller('admin/orders')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminOrdersController {
  constructor(
    private adminOrdersService: AdminOrdersService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all orders with filters (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated orders' })
  async findAll(@Query() query: AdminOrderListQueryDto) {
    return this.adminOrdersService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Order detail (admin only)' })
  @ApiResponse({ status: 200, description: 'Order detail' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminOrdersService.findOneAdmin(id);
  }

  @Patch(':id/transition')
  @ApiOperation({ summary: 'Move directly forward through fulfillment after payment (admin only)' })
  @ApiResponse({ status: 200, description: 'Order transitioned' })
  @ApiResponse({ status: 400, description: 'Illegal transition' })
  @ApiResponse({ status: 409, description: 'Order changed since the reviewed state' })
  async transition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransitionOrderDto,
    @Req() req: any,
  ) {
    const order = await this.adminOrdersService.transition(id, dto);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'STATUS_CHANGE',
      entity: 'Order',
      entityId: id,
      summary: `→ ${dto.to}`,
      ip: req.ip,
    });
    return order;
  }

  @Patch(':id/tracking')
  @ApiOperation({ summary: 'Set tracking code and shipping method (admin only)' })
  @ApiResponse({ status: 200, description: 'Tracking saved' })
  async setTracking(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetTrackingDto,
    @Req() req: any,
  ) {
    const order = await this.adminOrdersService.setTracking(id, dto);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'Order',
      entityId: id,
      summary: `tracking=${dto.trackingCode}`,
      ip: req.ip,
    });
    return order;
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a PENDING_PAYMENT order and release stock (admin only)' })
  @ApiResponse({ status: 200, description: 'Order canceled' })
  @ApiResponse({ status: 400, description: 'Only PENDING_PAYMENT orders can be canceled' })
  @ApiResponse({ status: 409, description: 'Another order operation already claimed the state' })
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelOrderDto,
    @Req() req: any,
  ) {
    const order = await this.adminOrdersService.cancel(id, dto.reason, dto.expectedStatus);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'STATUS_CHANGE',
      entity: 'Order',
      entityId: id,
      summary: `cancel${dto.reason ? `: ${dto.reason}` : ''}`,
      ip: req.ip,
    });
    return order;
  }

  @Post(':id/refund')
  @ApiOperation({
    summary: 'Mark a paid order as refunded — money moves outside the system (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Order marked refunded' })
  @ApiResponse({ status: 400, description: 'Order has no successful payment' })
  @ApiResponse({ status: 409, description: 'Already refunded' })
  async refund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RefundOrderDto,
    @Req() req: any,
  ) {
    const order = await this.adminOrdersService.markRefunded(id, dto.refundNote);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'Order',
      entityId: id,
      summary: 'mark refunded',
      ip: req.ip,
    });
    return order;
  }
}
