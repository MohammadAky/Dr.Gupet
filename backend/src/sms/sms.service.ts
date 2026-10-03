import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsDriver } from './sms-driver.interface';
import { ConsoleSmsDriver } from './console.driver';
import { SmsIrDriver } from './smsir.driver';

/**
 * Provider-agnostic SMS facade. Consumers (auth, payments, …) depend only on
 * this class — never on a concrete driver.
 *
 * The active driver is picked by `SMS_DRIVER`:
 *   - `console` (default) — logs only; dev/test/E2E.
 *   - `smsir`             — real sms.ir REST client (docs/SMS_IR_API.md).
 *   - anything else       — warn + fall back to console.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly driver: SmsDriver;

  constructor(configService: ConfigService) {
    const name = configService.get<string>('sms.driver') || 'console';

    switch (name) {
      case 'smsir':
        this.driver = new SmsIrDriver(configService);
        break;
      case 'console':
        this.driver = new ConsoleSmsDriver();
        break;
      default:
        this.logger.warn(`Unknown SMS_DRIVER "${name}" — falling back to console`);
        this.driver = new ConsoleSmsDriver();
    }
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    return this.driver.sendOtp(phone, code);
  }

  async sendText(phone: string, text: string): Promise<void> {
    return this.driver.sendText(phone, text);
  }
}
