import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Public()
  @Get('recommendations')
  @ApiOperation({ summary: 'Get product recommendations for a pet' })
  @ApiQuery({ name: 'petId', type: Number, required: true })
  @ApiResponse({ status: 200, description: 'Recommendations returned' })
  async getRecommendations(
    @Query('petId') petId: number,
    @Query() query: PaginationQueryDto,
  ) {
    // TODO: implement in Phase 7
    return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get products with filtering' })
  @ApiResponse({ status: 200, description: 'Products returned' })
  async findAll(@Query() query: PaginationQueryDto & any) {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get product detail by slug' })
  @ApiResponse({ status: 200, description: 'Product returned' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}