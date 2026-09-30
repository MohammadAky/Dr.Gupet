import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';
import { AdminOrdersService } from './admin-orders.service';
import { OrderStockService } from './order-stock.service';
import { CartModule } from '../cart/cart.module';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [CartModule, CouponsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, AdminOrdersService, OrderStockService],
  exports: [OrdersService, OrderStockService],
})
export class OrdersModule {}
