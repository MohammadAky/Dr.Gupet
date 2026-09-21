import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { Public } from '../../common/decorators/public.decorator';
import { TagType } from '@prisma/client';

@ApiTags('Tags')
@Controller('tags')
export class TagsController {
  constructor(private tagsService: TagsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get tags filtered by type' })
  @ApiQuery({ name: 'type', enum: TagType, required: false })
  @ApiResponse({ status: 200, description: 'Tags returned' })
  async findAll(@Query('type') type?: TagType) {
    return this.tagsService.findAll(type);
  }
}