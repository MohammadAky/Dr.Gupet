import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../audit/audit.service';
import { PopupDto } from './popup.dto';
import { PopupService, EMPTY_POPUP } from './popup.service';

@Controller('storefront/popup')
export class PublicPopupController {
  constructor(private readonly popups: PopupService) {}

  @Public()
  @Get()
  async read() {
    const content = await this.popups.read();
    return content.enabled ? content : { ...EMPTY_POPUP };
  }
}

@Controller('admin/storefront/popup')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminPopupController {
  constructor(
    private readonly popups: PopupService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  read() {
    return this.popups.read();
  }

  @Put()
  async save(@Body() dto: PopupDto, @Req() req: { user: { sub: number }; ip: string }) {
    const saved = await this.popups.save(dto);
    await this.audit.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'Setting',
      entityId: 'STOREFRONT_POPUP_V1',
      summary: saved.enabled ? 'Popup enabled' : 'Popup disabled',
      ip: req.ip,
    });
    return saved;
  }
}
