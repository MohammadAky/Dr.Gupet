import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Checkout from cart' })
  @ApiResponse({ status: 201, description: 'Order created' })
  @ApiResponse({ status: 400, description: 'Cart empty or invalid' })
  async checkout(
    @CurrentUser('sub') userId: number,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.checkout(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get my orders' })
  @ApiResponse({ status: 200, description: 'Orders returned' })
  async findAll(
    @CurrentUser('sub') userId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.ordersService.findAll(userId, query.page, query.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order returned' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.findOne(userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, description: 'Order canceled' })
  @ApiResponse({ status: 400, description: 'Invalid order state' })
  async cancel(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.cancel(userId, id);
  }
}