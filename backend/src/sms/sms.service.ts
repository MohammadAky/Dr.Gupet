import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
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
 *
 * Every send is recorded in `SmsLog` (kind OTP|NOTIFY, SENT|FAILED with the
 * provider message id or a safe error summary) so support can trace
 * "my code never arrived" tickets — phase 2 of the OTP/SMS consolidation.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly driver: SmsDriver;

  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const name = configService.get<string>('sms.driver') || 'console';
    const isProduction =
      (configService.get<string>('app.nodeEnv') || process.env.NODE_ENV) === 'production';

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
    await this.dispatch(phone, 'OTP', () => this.driver.sendOtp(phone, code));
  }

  async sendText(phone: string, text: string): Promise<void> {
    await this.dispatch(phone, 'NOTIFY', () => this.driver.sendText(phone, text));
  }

  private async dispatch(
    phone: string,
    kind: 'OTP' | 'NOTIFY',
    send: () => Promise<{ messageId?: number } | void>,
  ): Promise<void> {
    try {
      const result = await send();
      await this.log(phone, kind, 'SENT', {
        messageId: result?.messageId === undefined ? undefined : String(result.messageId),
      });
    } catch (error) {
      await this.log(phone, kind, 'FAILED', {
        error: String((error as Error).message ?? error).slice(0, 300),
        providerStatus: this.extractProviderStatus(error as Error),
      });
      throw error;
    }
  }

  /** Best-effort persistence — a logging failure must never break sending. */
  private async log(
    phone: string,
    kind: string,
    status: string,
    extra: { messageId?: string; providerStatus?: number; error?: string },
  ): Promise<void> {
    try {
      await this.prisma.smsLog.create({
        data: { phone, kind, status, ...extra },
      });
    } catch (error) {
      this.logger.warn(`SmsLog write failed: ${(error as Error).message}`);
    }
  }

  /** sms.ir failures carry `status=NN` in their message — persist the code. */
  private extractProviderStatus(error: Error): number | undefined {
    const match = /status=(-?\d+)/.exec(String(error?.message ?? ''));
    return match ? Number(match[1]) : undefined;
  }
}
