import { Module } from '@nestjs/common';
import { SmsModule } from '../../sms/sms.module';
import { PaymentsController } from './payments.controller';
import { PaymentsCallbackController } from './payments.callback.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsService } from './payments.service';
import { AdminPaymentsService } from './admin-payments.service';

@Module({
  imports: [SmsModule],
  controllers: [PaymentsController, PaymentsCallbackController, AdminPaymentsController],
  providers: [PaymentsService, AdminPaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
