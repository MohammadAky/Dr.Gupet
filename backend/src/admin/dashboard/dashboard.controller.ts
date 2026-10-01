import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

@ApiTags('Admin - Dashboard')
@Controller('admin')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    private prisma: PrismaService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Current admin profile (admin only)' })
  @ApiResponse({ status: 200, description: 'Admin user row' })
  async me(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.sub, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    return user;
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard KPIs and charts (admin only)' })
  @ApiResponse({ status: 200, description: 'Dashboard overview' })
  async overview() {
    return this.dashboardService.getOverview();
  }
}
