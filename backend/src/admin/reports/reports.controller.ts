import { Controller, Get, Query, UseGuards, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import {
  AdminLowStockQueryDto,
  AdminReportRangeQueryDto,
  AdminTopProductsQueryDto,
} from '../dto/admin-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RawResponse } from '../../common/decorators/raw-response.decorator';

@ApiTags('Admin - Reports')
@Controller('admin/reports')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('sales')
  @ApiOperation({ summary: 'Sales report by day (admin only)' })
  @ApiResponse({ status: 200, description: 'Sales report' })
  sales(@Query() range: AdminReportRangeQueryDto) {
    return this.reportsService.sales(range);
  }

  @Get('sales.csv')
  @RawResponse()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Sales report as CSV (admin only)' })
  async salesCsv(@Query() range: AdminReportRangeQueryDto) {
    return this.reportsService.buildSalesCsv(range);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Top selling products (admin only)' })
  topProducts(@Query() query: AdminTopProductsQueryDto) {
    const { limit, ...range } = query;
    return this.reportsService.topProducts(range, limit);
  }

  @Get('top-products.csv')
  @RawResponse()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Top selling products as CSV (admin only)' })
  async topProductsCsv(@Query() query: AdminTopProductsQueryDto) {
    const { limit, ...range } = query;
    return this.reportsService.buildTopProductsCsv(range, limit);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Low stock / out of stock variants (admin only)' })
  lowStock(@Query() query: AdminLowStockQueryDto) {
    return this.reportsService.lowStock(query.threshold);
  }

  @Get('users')
  @ApiOperation({ summary: 'User growth report (admin only)' })
  users(@Query() range: AdminReportRangeQueryDto) {
    return this.reportsService.userGrowth(range);
  }

  @Get('users.csv')
  @RawResponse()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'User growth report as CSV (admin only)' })
  async usersCsv(@Query() range: AdminReportRangeQueryDto) {
    return this.reportsService.buildUserGrowthCsv(range);
  }

  @Get('coupons')
  @ApiOperation({ summary: 'Coupon performance (admin only)' })
  coupons() {
    return this.reportsService.couponPerformance();
  }

  @Get('coupons.csv')
  @RawResponse()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Coupon performance as CSV (admin only)' })
  async couponsCsv() {
    return this.reportsService.buildCouponsCsv();
  }
}
