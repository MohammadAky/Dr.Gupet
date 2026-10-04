/**
 * Single source of truth for OTP Redis key names and time windows
 * (phase 1 of the OTP/SMS consolidation — nothing else may hardcode these).
 */

/** Window for the per-phone hourly request/attempt counters. */
export const OTP_HOURLY_WINDOW_SECONDS = 3600;

export const otpKeys = {
  code: (phone: string) => `otp:${phone}`,
  cooldown: (phone: string) => `otp:cooldown:${phone}`,
  count: (phone: string) => `otp:count:${phone}`,
  attempts: (phone: string) => `otp:attempts:${phone}`,
};
