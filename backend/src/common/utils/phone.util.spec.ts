import { normalizePhone } from './phone.util';

/**
 * normalizePhone is the single source of truth for phone normalization
 * (used by auth DTOs, users.createByAdmin, and the sms.ir driver).
 */
describe('normalizePhone', () => {
  it('accepts the canonical 09xxxxxxxxx form', () => {
    expect(normalizePhone('09121234567')).toBe('09121234567');
  });

  it('normalizes +98, 0098, 98 and bare 9-prefix forms', () => {
    for (const input of ['+989121234567', '00989121234567', '989121234567', '9121234567']) {
      expect(normalizePhone(input)).toBe('09121234567');
    }
  });

  it('handles Persian/Arabic digits, spaces and dashes', () => {
    expect(normalizePhone('۰۹۱۲۱۲۳۴۵۶۷')).toBe('09121234567');
    expect(normalizePhone('0912-123-4567')).toBe('09121234567');
    expect(normalizePhone('0912 123 4567')).toBe('09121234567');
    expect(normalizePhone('٠٩١٢١٢٣٤٥٦٧')).toBe('09121234567');
  });

  it('rejects invalid inputs with null', () => {
    for (const bad of ['', '123', '08121234567', '091212345', '091212345678', 'abc', null as any]) {
      expect(normalizePhone(bad)).toBeNull();
    }
  });
});
