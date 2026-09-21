import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductVariantsService } from './product-variants.service';
import { ProductsRecommendationService } from './products-recommendation.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductVariantsService, ProductsRecommendationService],
  exports: [ProductsService, ProductVariantsService, ProductsRecommendationService],
})
export class ProductsModule {}