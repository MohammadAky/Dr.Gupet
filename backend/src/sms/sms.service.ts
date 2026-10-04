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
 *   - anything else       — startup error (issue #04: unknown drivers never
 *     silently fall back).
 *
 * Production additionally refuses the console driver and missing sms.ir
 * credentials at startup (issue #04).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly driver: SmsDriver;

  constructor(configService: ConfigService) {
    const name = configService.get<string>('sms.driver') || 'console';
    const isProduction = process.env.NODE_ENV === 'production';

    switch (name) {
      case 'smsir':
        if (isProduction) {
          // Startup validation (issue #04) — dev/test may configure lazily.
          if (!configService.get<string>('sms.apiKey')) {
            throw new Error('SMS_API_KEY is required when SMS_DRIVER=smsir (production)');
          }
          if (!configService.get<string>('sms.templateId')) {
            throw new Error('SMS_IR_TEMPLATE_ID is required when SMS_DRIVER=smsir (production)');
          }
        }
        this.driver = new SmsIrDriver(configService);
        break;
      case 'console':
        if (isProduction) {
          throw new Error('SMS_DRIVER=console is not allowed in production');
        }
        this.driver = new ConsoleSmsDriver();
        break;
      default:
        // Unknown driver → startup error (issue #04).
        throw new Error(`Unknown SMS_DRIVER "${name}" — expected "console" or "smsir"`);
    }

    this.logger.log(`SMS driver initialized: ${name}`);
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    return this.driver.sendOtp(phone, code);
  }

  async sendText(phone: string, text: string): Promise<void> {
    return this.driver.sendText(phone, text);
  }
}
