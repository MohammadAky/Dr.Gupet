import { PaymentGateway, PaymentRequest, PaymentResponse, PaymentVerification } from './payment-gateway.interface';
import { tomanToRial } from '../../../common/utils/money.util';

export class MockPaymentGateway implements PaymentGateway {
  async request(data: PaymentRequest): Promise<PaymentResponse> {
    // Mock gateway returns a URL that auto-redirects to callback with success
    const paymentUrl = `http://localhost:3000/api/v1/payments/mock-pay?orderId=${data.orderId}&amount=${data.amount}`;

    return {
      gatewayRef: `mock-${Date.now()}`,
      paymentUrl,
    };
  }

  async verify(gatewayRef: string, amount: number): Promise<PaymentVerification> {
    // Mock gateway always succeeds
    return {
      success: true,
      amount,
    };
  }
}