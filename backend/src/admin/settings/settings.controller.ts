import { Controller, Get, Put, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService, SETTING_KEYS } from './settings.service';
import { SetSettingDto } from './dto/set-setting.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../../common/filters/all-exceptions.filter';

@ApiTags('Admin - Settings')
@Controller('admin/settings')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class SettingsController {
  constructor(
    private settingsService: SettingsService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List runtime settings (admin only)' })
  @ApiResponse({ status: 200, description: 'Settings list' })
  async findAll() {
    return this.settingsService.findAll();
  }

  @Put()
  @ApiOperation({ summary: 'Create or update a setting (admin only)' })
  @ApiResponse({ status: 200, description: 'Setting saved' })
  @ApiResponse({ status: 400, description: 'Unknown setting key' })
  async set(@Body() dto: SetSettingDto, @Req() req: any) {
    const row = await this.settingsService.set(dto.key, dto.value);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'UPDATE',
      entity: 'Setting',
      entityId: dto.key,
      summary: `${dto.key}=${dto.value}`,
      ip: req.ip,
    });
    return row;
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Remove a setting override so the env default applies (admin only)' })
  @ApiResponse({ status: 200, description: 'Setting removed' })
  @ApiResponse({ status: 400, description: 'Unknown setting key' })
  async remove(@Param('key') key: string, @Req() req: any) {
    if (!(SETTING_KEYS as readonly string[]).includes(key)) {
      throw new AppException('VALIDATION_ERROR', 'کلید تنظیمات نامعتبر است', 400);
    }
    const result = await this.settingsService.remove(key);
    await this.auditService.record({
      adminId: req.user.id,
      action: 'DELETE',
      entity: 'Setting',
      entityId: key,
      summary: `removed ${key}`,
      ip: req.ip,
    });
    return result;
  }
}
