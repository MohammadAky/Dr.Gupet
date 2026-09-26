import { describe, expect, it } from 'vitest';
<<<<<<< HEAD
import { sanitizeInternalRedirect } from './security';

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
=======
import { safePaymentUrl, sanitizeInternalRedirect } from './security';

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
  const api = 'http://localhost:3000/api/v1';

  it('accepts the current gateway and development mock destinations', () => {
    expect(safePaymentUrl('https://sandbox.zarinpal.com/pg/StartPay/A123', api, false)).toBe(
      'https://sandbox.zarinpal.com/pg/StartPay/A123',
    );
    expect(safePaymentUrl('https://www.zarinpal.com/pg/StartPay/A123', api, false)).toBe(
      'https://www.zarinpal.com/pg/StartPay/A123',
    );
    expect(
      safePaymentUrl('http://localhost:3000/api/v1/payments/mock-pay?orderId=1', api, true),
    ).toBe('http://localhost:3000/api/v1/payments/mock-pay?orderId=1');
  });

  it.each([
    'javascript:alert(1)',
    'https://evil.example/pg/StartPay/A123',
    'https://sandbox.zarinpal.com.evil.example/pg/StartPay/A123',
    'https://sandbox.zarinpal.com@evil.example/pg/StartPay/A123',
    'http://www.zarinpal.com/pg/StartPay/A123',
    'https://www.zarinpal.com/other/A123',
  ])('rejects untrusted payment destination %s', (url) => {
    expect(safePaymentUrl(url, api, true)).toBeNull();
  });

  it('rejects the mock gateway outside local development', () => {
    expect(
      safePaymentUrl('http://localhost:3000/api/v1/payments/mock-pay?orderId=1', api, false),
    ).toBeNull();
>>>>>>> frontend/design-system
  });
});
