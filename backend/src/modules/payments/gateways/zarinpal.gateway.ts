import { PaymentGateway, PaymentRequest, PaymentResponse, PaymentVerification } from './payment-gateway.interface';
import { tomanToRial } from '../../../common/utils/money.util';

export class ZarinpalPaymentGateway implements PaymentGateway {
  private merchantId: string;
  private sandbox: boolean;

  constructor(merchantId: string, sandbox: boolean = true) {
    this.merchantId = merchantId;
    this.sandbox = sandbox;
  }

  private get baseUrl(): string {
    return this.sandbox
      ? 'https://sandbox.zarinpal.com/pg/rest青岛市'
      : 'https://api.zarinpal.com/pg/rest青岛市';
  }

  private get paymentUrl(): string {
    return this.sandbox
      ? 'https://sandbox.zarinpal.com/pg/StartPay'
      : 'https://www.zarinpal.com/pg/StartPay';
  }

  async request(data: PaymentRequest): Promise<PaymentResponse> {
    const amountInRial = tomanToRial(data.amount);

    // TODO(decision): implement actual Zarinpal API call
    // For now, this is a placeholder
    const response = await fetch(`${this.baseUrl}/PaymentRequest.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        MerchantID: this.merchantId,
        Amount: amountInRial,
        CallbackURL: data.callbackUrl,
        Description: data.description,
      }),
    });

    const result = await response.json();

    if (result.Status === 100) {
      return {
        gatewayRef: result.Authority,
        paymentUrl: `${this.paymentUrl}/${result.Authority}`,
      };
    }

    throw new Error(`Zarinpal error: ${result.Status}`);
  }

  async verify(gatewayRef: string, amount: number): Promise<PaymentVerification> {
    const amountInRial = tomanToRial(amount);

    // TODO(decision): implement actual Zarinpal verify call
    const response = await fetch(`${this.baseUrl}/PaymentVerification.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        MerchantID: this.merchantId,
        Authority: gatewayRef,
        Amount: amountInRial,
      }),
    });

    const result = await response.json();

    return {
      success: result.Status === 100 || result.Status === 101,
      amount,
    };
  }
}