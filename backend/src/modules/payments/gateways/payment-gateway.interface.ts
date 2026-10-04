export interface PaymentRequest {
  amount: number; // in Toman
  orderId: number;
  /** Id of the local Payment record — gateways must bind it into their page link. */
  paymentId: number;
  /** HMAC signature of the callback URL so only genuine callbacks are accepted. */
  callbackSig: string;
  description: string;
  callbackUrl: string;
}

export interface PaymentResponse {
  gatewayRef: string;
  paymentUrl: string;
}

export interface PaymentVerification {
  success: boolean;
  amount: number; // in Toman
}

export interface PaymentGateway {
  request(data: PaymentRequest): Promise<PaymentResponse>;
  verify(gatewayRef: string, amount: number): Promise<PaymentVerification>;
}
