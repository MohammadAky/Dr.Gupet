import {
  PaymentGateway,
  PaymentRequest,
  PaymentResponse,
  PaymentVerification,
} from './payment-gateway.interface';
import { tomanToRial } from '../../../common/utils/money.util';

/**
 * Zarinpal gateway — classic WebGate contract (issues #05).
 *
 * Endpoints (classic REST WebGate):
 *   POST {apiBase}/PaymentRequest.json   → { Status: 100, Authority }
 *   POST {apiBase}/PaymentVerification.json → { Status: 100|101, RefID }
 *   StartPay: {startPayBase}/{Authority}
 *
 * `apiBase`/`startPayBase` can be overridden via env for tests or future
 * gateway-side changes without a code release.
 */
export class ZarinpalPaymentGateway implements PaymentGateway {
  constructor(
    private readonly merchantId: string,
    private readonly sandbox: boolean = true,
    private readonly apiBaseOverride?: string,
    private readonly startPayBaseOverride?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private get baseUrl(): string {
    if (this.apiBaseOverride) return this.apiBaseOverride.replace(/\/$/, '');
    return this.sandbox
      ? 'https://sandbox.zarinpal.com/pg/rest/WebGate'
      : 'https://ir.zarinpal.com/pg/rest/WebGate';
  }

  private get startPayUrl(): string {
    if (this.startPayBaseOverride) return this.startPayBaseOverride.replace(/\/$/, '');
    return this.sandbox
      ? 'https://sandbox.zarinpal.com/pg/StartPay'
      : 'https://www.zarinpal.com/pg/StartPay';
  }

  async request(data: PaymentRequest): Promise<PaymentResponse> {
    const amountInRial = tomanToRial(data.amount);

    const response = await this.fetchImpl(`${this.baseUrl}/PaymentRequest.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        MerchantID: this.merchantId,
        Amount: amountInRial,
        CallbackURL: data.callbackUrl,
        Description: data.description,
      }),
    });

    const result = (await response.json()) as { Status: number; Authority?: string };

    if (result.Status === 100 && result.Authority) {
      return {
        gatewayRef: result.Authority,
        paymentUrl: `${this.startPayUrl}/${result.Authority}`,
      };
    }

    throw new Error(`Zarinpal request failed: Status=${result.Status}`);
  }

  async verify(gatewayRef: string, amount: number): Promise<PaymentVerification> {
    const amountInRial = tomanToRial(amount);

    const response = await this.fetchImpl(`${this.baseUrl}/PaymentVerification.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        MerchantID: this.merchantId,
        Authority: gatewayRef,
        Amount: amountInRial,
      }),
    });

    const result = (await response.json()) as { Status: number };

    // 100 = verified, 101 = already verified (idempotent success)
    return {
      success: result.Status === 100 || result.Status === 101,
      amount,
    };
  }
}
