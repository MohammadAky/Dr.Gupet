import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { AdminProductsController } from './admin-products.controller';
import { ProductsService } from './products.service';
import { AdminProductsService } from './admin-products.service';
import { ProductVariantsService } from './product-variants.service';
import { ProductsRecommendationService } from './products-recommendation.service';
import { ProductsImportService } from './products-import.service';
import { ProductsSyncService } from './products-sync.service';
import { AdminProductSyncController } from './admin-product-sync.controller';

@Module({
  controllers: [ProductsController, AdminProductSyncController, AdminProductsController],
  providers: [
    ProductsService,
    AdminProductsService,
    ProductVariantsService,
    ProductsRecommendationService,
    ProductsImportService,
    ProductsSyncService,
  ],
  exports: [ProductsService, ProductVariantsService, ProductsRecommendationService],
})
export class ProductsModule {}
