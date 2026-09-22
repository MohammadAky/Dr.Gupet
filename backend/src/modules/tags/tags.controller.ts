import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Tags')
@Controller('tags')
export class TagsController {
  constructor(private tagsService: TagsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get tags filtered by type' })
  @ApiQuery({ name: 'type', enum: ['ALLERGEN', 'DIET'], required: false })
  @ApiResponse({ status: 200, description: 'Tags returned' })
  async findAll(@Query('type') type?: string) {
    return this.tagsService.findAll(type);
  }
}