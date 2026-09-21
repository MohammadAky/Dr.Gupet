import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get categories as tree' })
  @ApiQuery({ name: 'petTypeId', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Categories returned' })
  async findAll(@Query('petTypeId') petTypeId?: number) {
    return this.categoriesService.findAll(petTypeId ? Number(petTypeId) : undefined);
  }
}