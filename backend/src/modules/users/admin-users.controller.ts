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
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Admin - Users')
@Controller('admin/users')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminUsersController {
  constructor(
    private usersService: UsersService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List users with search/filters (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated users' })
  async findAll(
    @Query() query: PaginationQueryDto,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.usersService.findAllAdmin({ ...query, search, role, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'User detail with pets, addresses and recent orders (admin only)' })
  @ApiResponse({ status: 200, description: 'User detail' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOneAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create user by phone + role (admin only)' })
  @ApiResponse({ status: 201, description: 'Created user' })
  @ApiResponse({ status: 409, description: 'Phone already taken' })
  async create(
    @Body()
    body: {
      phone: string;
      role?: string;
      firstName?: string;
      lastName?: string;
    },
    @Req() req: any,
  ) {
    const user = await this.usersService.createByAdmin(body);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'CREATE',
      entity: 'User',
      entityId: user.id,
      summary: user.phone,
      ip: req.ip,
    });
    return user;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile/role/status (admin only)' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      avatar?: string;
      role?: string;
      status?: string;
    },
    @Req() req: any,
  ) {
    const user = await this.usersService.updateByAdmin(id, body);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      summary: Object.keys(body).join(','),
      ip: req.ip,
    });
    return user;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a user (admin only)' })
  @ApiResponse({ status: 200, description: 'User soft-deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.usersService.softDeleteByAdmin(id);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'DELETE',
      entity: 'User',
      entityId: id,
      summary: 'soft delete',
      ip: req.ip,
    });
    return result;
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted user (admin only)' })
  @ApiResponse({ status: 200, description: 'User restored' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async restore(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const user = await this.usersService.restoreByAdmin(id);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      summary: 'restore',
      ip: req.ip,
    });
    return user;
  }
}
