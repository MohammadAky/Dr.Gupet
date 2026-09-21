import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsDriver {
  sendOtp(phone: string, code: string): Promise<void>;
  sendText(phone: string, text: string): Promise<void>;
}

class ConsoleSmsDriver implements SmsDriver {
  private readonly logger = new Logger('SmsService');

  async sendOtp(phone: string, code: string): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[DEV SMS] OTP to ${phone}: ${code}`);
    }
  }

  async sendText(phone: string, text: string): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[DEV SMS] Text to ${phone}: ${text}`);
    }
  }
}

// Placeholder for real providers
class KavenegarSmsDriver implements SmsDriver {
  async sendOtp(_phone: string, _code: string): Promise<void> {
    // TODO(decision): implement Kavenegar API
    throw new Error('Kavenegar driver not implemented');
  }
  async sendText(_phone: string, _text: string): Promise<void> {
    throw new Error('Kavenegar driver not implemented');
  }
}

class SmsIrSmsDriver implements SmsDriver {
  async sendOtp(_phone: string, _code: string): Promise<void> {
    // TODO(decision): implement SmsIr API
    throw new Error('SmsIr driver not implemented');
  }
  async sendText(_phone: string, _text: string): Promise<void> {
    throw new Error('SmsIr driver not implemented');
  }
}

@Injectable()
export class SmsService {
  private readonly driver: SmsDriver;

  constructor(private configService: ConfigService) {
    const driverName = this.configService.get<string>('sms.driver') || 'console';

    switch (driverName) {
      case 'kavenegar':
        this.driver = new KavenegarSmsDriver();
        break;
      case 'smsir':
        this.driver = new SmsIrSmsDriver();
        break;
      default:
        this.driver = new ConsoleSmsDriver();
    }
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    return this.driver.sendOtp(phone, code);
  }

  async sendText(phone: string, text: string): Promise<void> {
    return this.driver.sendText(phone, text);
  }
}