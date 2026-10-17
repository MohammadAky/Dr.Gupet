import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';
import { ProductsSyncService } from './products-sync.service';
import { SyncProductsDto } from './dto/sync-products.dto';

export class ProductExportQuery {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(500) columns?: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) brandId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) categoryId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) petTypeId?: number;
}

@Controller('admin/products')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminProductSyncController {
  constructor(
    private sync: ProductsSyncService,
    private audit: AuditService,
  ) {}
  @Get('export.csv')
  async export(@Query() query: ProductExportQuery, @Res() response: Response) {
    const csv = await this.sync.exportCsv(query);
    response
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="products.csv"',
        'Cache-Control': 'no-store',
      })
      .send(csv);
  }
  @Post('sync/preview')
  preview(@Body() dto: SyncProductsDto) {
    return this.sync.synchronize(dto, true);
  }
  @Post('sync')
  async apply(@Body() dto: SyncProductsDto, @Req() req: { user: { sub: number }; ip: string }) {
    const result = await this.sync.synchronize(dto, false);
    await this.audit.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'Product',
      summary: 'reviewed CSV synchronization',
      ip: req.ip,
    });
    return result;
  }
}
