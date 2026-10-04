import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RequestOtpDto } from './request-otp.dto';
import { VerifyOtpDto } from './verify-otp.dto';

/**
 * Phone fields normalize via `normalizePhone` before validation, so
 * `+989121234567`/`9121234567` become `09121234567` instead of being
 * rejected — one normalization story across the whole API.
 */
function validate(dto: any, plain: any) {
  return validateSync(plainToInstance(dto, plain));
}

describe('OTP DTO phone normalization', () => {
  it.each([['+989121234567'], ['00989121234567'], ['9121234567'], ['۰۹۱۲۱۲۳۴۵۶۷']])(
    'RequestOtpDto accepts %s and stores 09121234567',
    (phone) => {
      const dto = plainToInstance(RequestOtpDto, { phone });
      expect(dto.phone).toBe('09121234567');
      expect(validate(RequestOtpDto, { phone })).toHaveLength(0);
    },
  );

  it('RequestOtpDto rejects invalid numbers', () => {
    expect(validate(RequestOtpDto, { phone: '123' })).not.toHaveLength(0);
  });

  it('VerifyOtpDto normalizes phone the same way and checks the code', () => {
    const dto = plainToInstance(VerifyOtpDto, { phone: '+989121234567', code: '12345' });
    expect(dto.phone).toBe('09121234567');
    expect(validate(VerifyOtpDto, { phone: '+989121234567', code: '12345' })).toHaveLength(0);
    expect(validate(VerifyOtpDto, { phone: '09121234567', code: 'abc' })).not.toHaveLength(0);
  });
});
