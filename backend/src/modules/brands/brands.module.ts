import { Module } from '@nestjs/common';
import { BrandsController } from './brands.controller';
import { AdminBrandsController } from './admin-brands.controller';
import { BrandsService } from './brands.service';

@Module({
  controllers: [BrandsController, AdminBrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
