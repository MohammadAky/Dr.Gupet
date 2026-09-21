import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get my cart' })
  @ApiResponse({ status: 200, description: 'Cart returned' })
  async getCart(@CurrentUser('sub') userId: number) {
    return this.cartService.getCart(userId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiResponse({ status: 201, description: 'Item added' })
  @ApiResponse({ status: 400, description: 'Variant unavailable or out of stock' })
  async addItem(
    @CurrentUser('sub') userId: number,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(userId, dto.variantId, dto.quantity || 1);
  }

  @Patch('items/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiResponse({ status: 200, description: 'Item updated' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async updateItem(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(userId, id, dto.quantity);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({ status: 200, description: 'Item removed' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async removeItem(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cartService.removeItem(userId, id);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear cart' })
  @ApiResponse({ status: 200, description: 'Cart cleared' })
  async clearCart(@CurrentUser('sub') userId: number) {
    return this.cartService.clearCart(userId);
  }
}