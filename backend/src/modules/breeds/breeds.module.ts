import { Module } from '@nestjs/common';
import { BreedsController } from './breeds.controller';
import { AdminBreedsController } from './admin-breeds.controller';
import { BreedsService } from './breeds.service';

@Module({
  controllers: [BreedsController, AdminBreedsController],
  providers: [BreedsService],
  exports: [BreedsService],
})
export class BreedsModule {}
