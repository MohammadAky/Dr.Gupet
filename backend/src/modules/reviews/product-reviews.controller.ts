import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProductReviewsService } from './product-reviews.service';
import { ReviewListQueryDto, UpdateReviewDto, WriteReviewDto } from './dto/review.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Issue #37 — reviews live under the product they belong to, and the writing
 * side always takes the user from the session (never from the request body).
 */
@ApiTags('Reviews')
@Controller('products')
export class ProductReviewsController {
  constructor(private reviews: ProductReviewsService) {}

  @Public()
  @Get(':slug/reviews')
  @ApiOperation({ summary: 'Public, paginated reviews of a product' })
  @ApiResponse({ status: 200, description: 'Visible reviews with summary' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async list(@Param('slug') slug: string, @Query() query: ReviewListQueryDto) {
    return this.reviews.list(slug, query);
  }

  @Get(':slug/review-eligibility')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Whether the current user may review this product' })
  @ApiResponse({ status: 200, description: 'Eligibility, reason and existing review' })
  async eligibility(@Param('slug') slug: string, @CurrentUser('sub') userId: number) {
    return this.reviews.eligibility(userId, slug);
  }

  @Post(':slug/reviews')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a review for a delivered purchase' })
  @ApiResponse({ status: 201, description: 'Review created' })
  @ApiResponse({ status: 403, description: 'No delivered purchase for this product' })
  @ApiResponse({ status: 409, description: 'Review already exists' })
  async create(
    @Param('slug') slug: string,
    @Body() dto: WriteReviewDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.reviews.create(userId, slug, dto);
  }

  @Patch(':slug/reviews/mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit the current user’s review' })
  async update(
    @Param('slug') slug: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.reviews.update(userId, slug, dto);
  }

  @Delete(':slug/reviews/mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete the current user’s review' })
  async remove(@Param('slug') slug: string, @CurrentUser('sub') userId: number) {
    return this.reviews.remove(userId, slug);
  }
}
