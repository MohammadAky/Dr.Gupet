import { describe, expect, it } from 'vitest';
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
  });
});
