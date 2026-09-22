export interface PaymentRequest {
  amount: number; // in Toman
  orderId: number;
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