import { Module } from '@nestjs/common';
import { PetTypesController } from './pet-types.controller';
import { PetTypesService } from './pet-types.service';

@Module({
  controllers: [PetTypesController],
  providers: [PetTypesService],
  exports: [PetTypesService],
})
export class PetTypesModule {}