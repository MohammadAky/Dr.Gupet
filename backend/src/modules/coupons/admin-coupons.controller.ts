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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminCouponsService } from './admin-coupons.service';
import { CreateCouponDto, UpdateCouponDto } from './dto/admin-coupon.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Admin - Coupons')
@Controller('admin/coupons')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminCouponsController {
  constructor(
    private adminCouponsService: AdminCouponsService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List coupons with usage counts (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated coupons' })
  async findAll(
    @Query() query: PaginationQueryDto,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.adminCouponsService.findAllAdmin({
      ...query,
      search,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Coupon detail with recent redemptions (admin only)' })
  @ApiResponse({ status: 200, description: 'Coupon detail' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminCouponsService.findOneAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create coupon (admin only)' })
  @ApiResponse({ status: 201, description: 'Coupon created' })
  @ApiResponse({ status: 409, description: 'Duplicate code' })
  async create(@Body() dto: CreateCouponDto, @Req() req: any) {
    const coupon = await this.adminCouponsService.create(dto);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'CREATE',
      entity: 'Coupon',
      entityId: coupon.id,
      summary: coupon.code,
      ip: req.ip,
    });
    return coupon;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update coupon (admin only)' })
  @ApiResponse({ status: 200, description: 'Coupon updated' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCouponDto,
    @Req() req: any,
  ) {
    const coupon = await this.adminCouponsService.update(id, dto);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'UPDATE',
      entity: 'Coupon',
      entityId: id,
      summary: Object.keys(dto).join(','),
      ip: req.ip,
    });
    return coupon;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete coupon — deactivates when already used (admin only)' })
  @ApiResponse({ status: 200, description: 'Delete result' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.adminCouponsService.remove(id);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'DELETE',
      entity: 'Coupon',
      entityId: id,
      summary: result.deleted ? 'deleted' : 'deactivated (has redemptions)',
      ip: req.ip,
    });
    return result;
  }
}
