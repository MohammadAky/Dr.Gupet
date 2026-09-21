import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductsRecommendationService } from './products-recommendation.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    private recommendationsService: ProductsRecommendationService,
  ) {}

  @Get('recommendations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get product recommendations for a pet' })
  @ApiQuery({ name: 'petId', type: Number, required: true })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Recommendations returned' })
  @ApiResponse({ status: 404, description: 'Pet not found' })
  async getRecommendations(
    @CurrentUser('sub') userId: number,
    @Query('petId') petId: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.recommendationsService.findForPet(
      userId,
      Number(petId),
      page || 1,
      limit || 20,
    );
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