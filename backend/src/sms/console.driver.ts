import { Injectable, Logger } from '@nestjs/common';

/**
 * Dev/test driver — logs instead of calling the network.
 * Selected by `SMS_DRIVER=console` (the default).
 */
@Injectable()
export class ConsoleSmsDriver {
  private readonly logger = new Logger('SmsService');

  async sendOtp(phone: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn('[DEV SMS] OTP send skipped (SMS_DRIVER=console) in production');
      return;
    }
    this.logger.log(`[DEV SMS] OTP to ${phone}: ${code}`);
  }

  async sendText(phone: string, text: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn('[DEV SMS] Text send skipped (SMS_DRIVER=console) in production');
      return;
    }
    this.logger.log(`[DEV SMS] Text to ${phone}: ${text}`);
  }
}
