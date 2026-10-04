import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { SmsLogsService } from './sms-logs.service';

@ApiTags('Admin - SMS logs')
@Controller('admin/sms')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminSmsLogsController {
  constructor(private smsLogsService: SmsLogsService) {}

  @Get('logs')
  @ApiOperation({ summary: 'SMS delivery log (OTP/notifications) with filters' })
  async findAll(
    @Query() query: PaginationQueryDto,
    @Query('phone') phone?: string,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
  ) {
    return this.smsLogsService.findAllAdmin({ ...query, phone, kind, status });
  }
}
