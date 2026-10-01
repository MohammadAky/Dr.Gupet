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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';

@ApiTags('Admin - Tags')
@Controller('admin/tags')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminTagsController {
  constructor(
    private tagsService: TagsService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tags with usage counts (admin only)' })
  async findAll(@Query('type') type?: string) {
    return this.tagsService.findAllAdmin(type);
  }

  @Post()
  @ApiOperation({ summary: 'Create tag (admin only)' })
  async create(@Body() body: { name: string; slug?: string; type: string }, @Req() req: any) {
    const tag = await this.tagsService.create(body);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'CREATE',
      entity: 'Tag',
      entityId: tag.id,
      summary: `${tag.name} (${tag.type})`,
      ip: req.ip,
    });
    return tag;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename tag (admin only)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ name: string }>,
    @Req() req: any,
  ) {
    const tag = await this.tagsService.update(id, body);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'Tag',
      entityId: id,
      summary: body.name ?? '',
      ip: req.ip,
    });
    return tag;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete unused tag (admin only)' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.tagsService.remove(id);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'DELETE',
      entity: 'Tag',
      entityId: id,
      summary: 'deleted',
      ip: req.ip,
    });
    return result;
  }
}
