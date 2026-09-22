import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { validate } from './config/env.validation';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import smsConfig from './config/sms.config';
import paymentConfig from './config/payment.config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SmsModule } from './sms/sms.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { UploadModule } from './upload/upload.module';
import { PetTypesModule } from './modules/pet-types/pet-types.module';
import { BreedsModule } from './modules/breeds/breeds.module';
import { TagsModule } from './modules/tags/tags.module';
import { PetsModule } from './modules/pets/pets.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { CartModule } from './modules/cart/cart.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MedicinesModule } from './modules/medicines/medicines.module';
import { PharmaciesModule } from './modules/pharmacies/pharmacies.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, redisConfig, smsConfig, paymentConfig],
      validate,
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: 60000,
            limit: 100,
          },
        ],
      }),
    }),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Infrastructure modules
    PrismaModule,
    RedisModule,
    SmsModule,

    // Feature modules
    HealthModule,
    AuthModule,
    UsersModule,
    AddressesModule,
    UploadModule,
    PetTypesModule,
    BreedsModule,
    TagsModule,
    PetsModule,
    BrandsModule,
    CategoriesModule,
    ProductsModule,
    FavoritesModule,
    CartModule,
    CouponsModule,
    OrdersModule,
    PaymentsModule,
    MedicinesModule,
    PharmaciesModule,
  ],
  providers: [
    // Global guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    // Global filters
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },

    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformResponseInterceptor,
    },
  ],
})
export class AppModule {}