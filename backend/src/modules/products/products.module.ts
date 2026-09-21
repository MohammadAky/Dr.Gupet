import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductVariantsService } from './product-variants.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductVariantsService],
  exports: [ProductsService, ProductVariantsService],
})
export class ProductsModule {}