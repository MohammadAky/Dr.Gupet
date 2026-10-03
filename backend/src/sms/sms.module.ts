import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';

/**
 * Generic SMS module — provider-agnostic.
 *
 * Imported explicitly by feature modules that send messages
 * (AuthModule for OTP, PaymentsModule for notifications); not global.
 */
@Module({
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
