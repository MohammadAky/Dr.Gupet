import { Module } from '@nestjs/common';
import { MedicinesController } from './medicines.controller';
import { AdminMedicinesController } from './admin-medicines.controller';
import { MedicinesService } from './medicines.service';

@Module({
  controllers: [MedicinesController, AdminMedicinesController],
  providers: [MedicinesService],
  exports: [MedicinesService],
})
export class MedicinesModule {}
