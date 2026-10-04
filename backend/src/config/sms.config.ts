import { registerAs } from '@nestjs/config';

export default registerAs('sms', () => ({
  // console = log only (dev/tests) | smsir = real sms.ir REST API
  driver: process.env.SMS_DRIVER || 'console',
  apiKey: process.env.SMS_API_KEY,
  templateId: process.env.SMS_IR_TEMPLATE_ID,
  paramName: process.env.SMS_IR_PARAM_NAME || 'Code',
  baseUrl: process.env.SMS_IR_BASE_URL || 'https://api.sms.ir/v1',
  lineNumber: process.env.SMS_IR_LINE_NUMBER,
  // Notification policy — which events text the user (payment success, …).
  notifyPaymentSuccess: process.env.SMS_NOTIFY_PAYMENT_SUCCESS !== 'false',
}));
