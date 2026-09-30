import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { AdminProductsController } from './admin-products.controller';
import { ProductsService } from './products.service';
import { AdminProductsService } from './admin-products.service';
import { ProductVariantsService } from './product-variants.service';
import { ProductsRecommendationService } from './products-recommendation.service';

@Module({
  controllers: [ProductsController, AdminProductsController],
  providers: [
    ProductsService,
    AdminProductsService,
    ProductVariantsService,
    ProductsRecommendationService,
  ],
  exports: [ProductsService, ProductVariantsService, ProductsRecommendationService],
})
export class ProductsModule {}
