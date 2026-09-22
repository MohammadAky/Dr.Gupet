import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsCallbackController } from './payments.callback.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController, PaymentsCallbackController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}