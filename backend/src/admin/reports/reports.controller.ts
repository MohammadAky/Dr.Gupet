import { Controller, Get, Query, UseGuards, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService, ReportRange } from './reports.service';
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
  sales(@Query() range: ReportRange) {
    return this.reportsService.sales(range);
  }

  @Get('sales.csv')
  @RawResponse()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Sales report as CSV (admin only)' })
  async salesCsv(@Query() range: ReportRange) {
    return this.reportsService.buildSalesCsv(range);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Top selling products (admin only)' })
  topProducts(@Query() range: ReportRange, @Query('limit') limit?: string) {
    return this.reportsService.topProducts(range, limit ? Number(limit) : undefined);
  }

  @Get('top-products.csv')
  @RawResponse()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Top selling products as CSV (admin only)' })
  async topProductsCsv(@Query() range: ReportRange, @Query('limit') limit?: string) {
    return this.reportsService.buildTopProductsCsv(range, limit ? Number(limit) : undefined);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Low stock / out of stock variants (admin only)' })
  lowStock(@Query('threshold') threshold?: string) {
    return this.reportsService.lowStock(threshold ? Number(threshold) : undefined);
  }

  @Get('users')
  @ApiOperation({ summary: 'User growth report (admin only)' })
  users(@Query() range: ReportRange) {
    return this.reportsService.userGrowth(range);
  }

  @Get('users.csv')
  @RawResponse()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'User growth report as CSV (admin only)' })
  async usersCsv(@Query() range: ReportRange) {
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
