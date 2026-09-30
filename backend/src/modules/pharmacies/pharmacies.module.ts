import { Module } from '@nestjs/common';
import { PharmaciesController } from './pharmacies.controller';
import { AdminPharmaciesController } from './admin-pharmacies.controller';
import { PharmaciesService } from './pharmacies.service';

@Module({
  controllers: [PharmaciesController, AdminPharmaciesController],
  providers: [PharmaciesService],
  exports: [PharmaciesService],
})
export class PharmaciesModule {}
