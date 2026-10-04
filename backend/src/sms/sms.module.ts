import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsLogsService } from './sms-logs.service';
import { AdminSmsLogsController } from './admin-sms-logs.controller';

/**
 * Generic SMS module — provider-agnostic.
 *
 * Imported explicitly by feature modules that send messages
 * (AuthModule for OTP, PaymentsModule for notifications); not global.
 * Also hosts the admin read-API for the SmsLog delivery log.
 */
@Module({
  controllers: [AdminSmsLogsController],
  providers: [SmsService, SmsLogsService],
  exports: [SmsService],
})
export class SmsModule {}
