import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStockService } from './order-stock.service';
import { CartModule } from '../cart/cart.module';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [CartModule, CouponsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStockService],
  exports: [OrdersService, OrderStockService],
})
export class OrdersModule {}