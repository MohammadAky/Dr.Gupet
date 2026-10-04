import { Injectable, Logger } from '@nestjs/common';
import type { SmsDriver, SmsSendResult } from './sms-driver.interface';

/**
 * Dev/test driver — logs instead of calling the network.
 * Selected by `SMS_DRIVER=console` (the default). The SmsService facade
 * refuses to construct this driver in production, so no guard is needed here.
 */
@Injectable()
export class ConsoleSmsDriver implements SmsDriver {
  private readonly logger = new Logger('ConsoleSmsDriver');

  async sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    this.logger.log(`[DEV SMS] OTP to ${phone}: ${code}`);
    return {};
  }

  async sendText(phone: string, text: string): Promise<SmsSendResult> {
    this.logger.log(`[DEV SMS] Text to ${phone}: ${text}`);
    return {};
  }
}
