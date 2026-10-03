import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsDriver } from './sms-driver.interface';

/** Response envelope of the sms.ir REST API (docs/SMS_IR_API.md §1.3). */
interface SmsIrEnvelope<T = unknown> {
  status: number;
  message: string;
  data?: T;
}

const REQUEST_TIMEOUT_MS = 10_000;
const TRANSIENT_RETRY_DELAY_MS = 300;
const MAX_ATTEMPTS = 2; // 1 try + 1 retry, transient failures only (§8.4-3)

/**
 * sms.ir driver — selected by `SMS_DRIVER=smsir`.
 *
 * - `sendOtp(phone, code)`    → `POST /v1/send/verify` (OTP through a service line).
 * - `sendText(phone, text)`   → `POST /v1/send/bulk` (free-text notification, e.g. payment success).
 *
 * The OTP code itself is generated and verified by `OtpService` (hashed in Redis);
 * sms.ir only delivers the message — see docs/SMS_IR_API.md §8.4.
 */
@Injectable()
export class SmsIrDriver implements SmsDriver {
  private readonly logger = new Logger(SmsIrDriver.name);

  constructor(private readonly configService: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const apiKey = this.requireConfig('sms.apiKey', 'SMS_API_KEY');
    const templateId = Number(this.requireConfig('sms.templateId', 'SMS_IR_TEMPLATE_ID'));
    if (!Number.isInteger(templateId) || templateId <= 0) {
      throw new Error('sms.ir is not configured: SMS_IR_TEMPLATE_ID must be a numeric template id');
    }
    const paramName = this.configService.get<string>('sms.paramName') || 'Code';

    await this.post('/send/verify', apiKey, {
      mobile: this.normalizeMobile(phone),
      templateId,
      parameters: [{ name: paramName, value: code }], // value ≤ 25 chars (§2.2)
    });
  }

  async sendText(phone: string, text: string): Promise<void> {
    const apiKey = this.requireConfig('sms.apiKey', 'SMS_API_KEY');
    const lineNumber = Number(this.requireConfig('sms.lineNumber', 'SMS_IR_LINE_NUMBER'));
    if (!Number.isInteger(lineNumber) || lineNumber <= 0) {
      throw new Error('sms.ir is not configured: SMS_IR_LINE_NUMBER must be a numeric line');
    }

    await this.post('/send/bulk', apiKey, {
      lineNumber,
      messageText: text,
      mobiles: [this.normalizeMobile(phone)],
    });
  }

  /**
   * POST to the sms.ir API.
   * - Success ⇔ HTTP 2xx **and** `status === 1` (§1.3).
   * - Retries once, only for transient failures: HTTP 429/5xx or status 0/20 (§8.4-3).
   * - The API key is never logged; `messageId`/`status` are.
   */
  private async post(
    path: string,
    apiKey: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const baseUrl = (
      this.configService.get<string>('sms.baseUrl') || 'https://api.sms.ir/v1'
    ).replace(/\/+$/, '');
    let lastFailure = 'unknown error';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        await new Promise((resolve) => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS));
      }

      let response: Response;
      try {
        response = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        // Timeout / connection reset — transient (§8.4-3/4)
        lastFailure = `network error: ${(error as Error).message}`;
        continue;
      }

      let envelope: SmsIrEnvelope;
      try {
        envelope = (await response.json()) as SmsIrEnvelope;
      } catch {
        lastFailure = `non-JSON response (http=${response.status})`;
        continue;
      }

      if (response.ok && envelope.status === 1) {
        const messageId = (envelope.data as { messageId?: number } | undefined)?.messageId;
        this.logger.log(
          `sms.ir ${path} ok (status=1${messageId !== undefined ? `, messageId=${messageId}` : ''})`,
        );
        return envelope.data;
      }

      lastFailure = `http=${response.status} status=${envelope.status} message=${envelope.message}`;

      const transient =
        response.status === 429 ||
        response.status >= 500 ||
        envelope.status === 0 ||
        envelope.status === 20;
      if (!transient) {
        break; // logical error (113, 114, 104, ...) — retry is pointless (§8.4-3)
      }
    }

    throw new Error(`sms.ir ${path} failed: ${lastFailure}`);
  }

  private requireConfig(key: string, envName: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`sms.ir is not configured: ${envName} is missing`);
    }
    return value;
  }

  /** Normalize an Iranian mobile to the national `09xxxxxxxxx` format (§2.5). */
  private normalizeMobile(phone: string): string {
    const digits = phone.replace(/[^\d+]/g, '');
    if (/^09\d{9}$/.test(digits)) return digits;
    if (/^989\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
    if (/^\+989\d{9}$/.test(digits)) return `0${digits.slice(3)}`;
    if (/^9\d{9}$/.test(digits)) return `0${digits}`;
    throw new Error(`invalid Iranian mobile number: ${phone}`);
  }
}
