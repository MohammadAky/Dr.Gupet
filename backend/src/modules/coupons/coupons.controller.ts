import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CartService } from '../cart/cart.service';

@ApiTags('Coupons')
@ApiBearerAuth()
@Controller('coupons')
export class CouponsController {
  constructor(
    private couponsService: CouponsService,
    private cartService: CartService,
  ) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate coupon and preview discount' })
  @ApiResponse({ status: 200, description: 'Coupon validated' })
  @ApiResponse({ status: 400, description: 'Invalid coupon' })
  async validate(
    @CurrentUser('sub') userId: number,
    @Body() dto: ApplyCouponDto,
  ) {
    // Get cart total
    const cart = await this.cartService.getCart(userId);
    const itemsTotal = cart.itemsTotal;

    // Validate coupon against current cart
    return this.couponsService.validate(dto.code.toUpperCase(), userId, itemsTotal);
  }
}