import { registerAs } from '@nestjs/config';

export default registerAs('sms', () => ({
  driver: process.env.SMS_DRIVER || 'console',
  apiKey: process.env.SMS_API_KEY,
}));
