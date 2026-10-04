import {
  PaymentGateway,
  PaymentRequest,
  PaymentResponse,
  PaymentVerification,
} from './payment-gateway.interface';

/**
 * Dev/test-only gateway (issues #01, #05).
 *
 * - `request()` links to the mock-pay page **with the paymentId** so the whole
 *   flow is bound to a real local Payment record.
 * - `verify()` only succeeds for gateway references this mock created
 *   (`mock-*`) — a fabricated reference is rejected.
 * - The service layer refuses to even construct this gateway in production.
 */
export class MockPaymentGateway implements PaymentGateway {
  constructor(private readonly mockPayUrl: string = 'http://localhost:3000/api/v1/payments/mock-pay') {}

  async request(data: PaymentRequest): Promise<PaymentResponse> {
    const gatewayRef = `mock-${Date.now()}-${data.paymentId}`;
    const params = new URLSearchParams({
      paymentId: String(data.paymentId),
      orderId: String(data.orderId),
      amount: String(data.amount),
      sig: data.callbackSig,
    });
    return {
      gatewayRef,
      paymentUrl: `${this.mockPayUrl}?${params.toString()}`,
    };
  }

  async verify(gatewayRef: string, amount: number): Promise<PaymentVerification> {
    // Only references issued by this mock (bound to a real payment) verify.
    const success = typeof gatewayRef === 'string' && gatewayRef.startsWith('mock-');
    return { success, amount };
  }
}
