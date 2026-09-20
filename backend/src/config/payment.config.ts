import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  driver: process.env.PAYMENT_DRIVER || 'mock',
  zarinpalMerchantId: process.env.ZARINPAL_MERCHANT_ID,
  zarinpalSandbox: process.env.ZARINPAL_SANDBOX === 'true',
  callbackUrl: process.env.PAYMENT_CALLBACK_URL,
  frontendResultUrl: process.env.FRONTEND_PAYMENT_RESULT_URL,
}));