import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  driver: process.env.PAYMENT_DRIVER || 'mock',
  zarinpalMerchantId: process.env.ZARINPAL_MERCHANT_ID,
  zarinpalSandbox: process.env.ZARINPAL_SANDBOX === 'true',
  zarinpalApiBase: process.env.ZARINPAL_API_BASE,
  zarinpalStartPayBase: process.env.ZARINPAL_STARTPAY_BASE,
  callbackUrl: process.env.PAYMENT_CALLBACK_URL,
  frontendResultUrl: process.env.FRONTEND_PAYMENT_RESULT_URL,
  mockPayUrl: process.env.PAYMENT_MOCK_PAY_URL,
  callbackSecret: process.env.PAYMENT_CALLBACK_SECRET,
}));
