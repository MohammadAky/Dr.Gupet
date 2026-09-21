import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Get my favorites' })
  @ApiResponse({ status: 200, description: 'Favorites returned' })
  async findAll(
    @CurrentUser('sub') userId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.favoritesService.findAll(userId, query);
  }

  @Put(':productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add to favorites' })
  @ApiResponse({ status: 200, description: 'Added to favorites' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async add(
    @CurrentUser('sub') userId: number,
    @Param('productId') productId: number,
  ) {
    return this.favoritesService.add(userId, Number(productId));
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove from favorites' })
  @ApiResponse({ status: 200, description: 'Removed from favorites' })
  async remove(
    @CurrentUser('sub') userId: number,
    @Param('productId') productId: number,
  ) {
    return this.favoritesService.remove(userId, Number(productId));
  }
}