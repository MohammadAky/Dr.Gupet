import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { AdminCouponsController } from './admin-coupons.controller';
import { CouponsService } from './coupons.service';
import { AdminCouponsService } from './admin-coupons.service';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [CartModule],
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService, AdminCouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
