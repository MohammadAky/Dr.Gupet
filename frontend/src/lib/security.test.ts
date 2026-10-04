import { describe, expect, it } from 'vitest';
import { safePaymentUrl, sanitizeInternalRedirect } from './security';

describe('sanitizeInternalRedirect', () => {
  it('accepts safe internal paths', () => {
    expect(sanitizeInternalRedirect('/cart')).toBe('/cart');
    expect(sanitizeInternalRedirect('/products?sort=newest')).toBe('/products?sort=newest');
    expect(sanitizeInternalRedirect('/orders/12')).toBe('/orders/12');
  });

  it('rejects external URLs (Open Redirect mitigation)', () => {
    expect(sanitizeInternalRedirect('https://evil.com')).toBe('/');
    expect(sanitizeInternalRedirect('http://evil.com')).toBe('/');
    expect(sanitizeInternalRedirect('//evil.com')).toBe('/');
    expect(sanitizeInternalRedirect('javascript:alert(1)')).toBe('/');
  });

  it('rejects backslashes and control characters', () => {
    expect(sanitizeInternalRedirect('/\\evil.com')).toBe('/');
    expect(sanitizeInternalRedirect('/cart\r\nevil')).toBe('/');
  });

  it('falls back to custom fallback if provided', () => {
    expect(sanitizeInternalRedirect('https://evil.com', '/home')).toBe('/home');
    expect(sanitizeInternalRedirect(null, '/home')).toBe('/home');
  });
});

describe('sanitizeInternalRedirect', () => {
  it('keeps an internal route with query and hash', () => {
    expect(sanitizeInternalRedirect('/products?q=cat#reviews')).toBe('/products?q=cat#reviews');
  });

  it.each([
    null,
    '',
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example/path',
    '/\nevil.example',
    '/login?next=/cart',
    '/verify',
  ])('rejects unsafe or recursive next=%s', (value) => {
    expect(sanitizeInternalRedirect(value)).toBe('/');
  });
});

describe('safePaymentUrl', () => {
  it('accepts the live gateway destination', () => {
    expect(safePaymentUrl('https://www.zarinpal.com/pg/StartPay/A123')).toBe(
      'https://www.zarinpal.com/pg/StartPay/A123',
    );
  });

  it.each([
    'javascript:alert(1)',
    'https://evil.example/pg/StartPay/A123',
    'https://sandbox.zarinpal.com.evil.example/pg/StartPay/A123',
    'https://sandbox.zarinpal.com/pg/StartPay/A123',
    'http://localhost:3000/api/v1/payments/mock-pay?orderId=1',
    'https://sandbox.zarinpal.com@evil.example/pg/StartPay/A123',
    'http://www.zarinpal.com/pg/StartPay/A123',
    'https://www.zarinpal.com/other/A123',
  ])('rejects untrusted payment destination %s', (url) => {
    expect(safePaymentUrl(url)).toBeNull();
  });
});
