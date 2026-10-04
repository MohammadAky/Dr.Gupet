// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOtpPhone, readOtpCooldown, storeOtpCooldown, storeOtpPhone } from './otp-flow';

describe('OTP resend timing', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T12:00:00.000Z'));
  });
  afterEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it('uses the server cooldown and survives a same-tab reload', () => {
    storeOtpPhone('09123456789');
    storeOtpCooldown('09123456789', 42);
    expect(readOtpCooldown('09123456789')).toBe(42);
    vi.advanceTimersByTime(2000);
    expect(readOtpCooldown('09123456789')).toBe(40);
    expect(readOtpCooldown('09999999999')).toBe(0);
    vi.advanceTimersByTime(40000);
    expect(readOtpCooldown('09123456789')).toBe(0);
  });

  it('clears the timing with the phone number', () => {
    storeOtpPhone('09123456789');
    storeOtpCooldown('09123456789', 42);
    clearOtpPhone();
    expect(readOtpCooldown('09123456789')).toBe(0);
  });
});
