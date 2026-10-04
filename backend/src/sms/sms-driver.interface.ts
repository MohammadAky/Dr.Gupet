/**
 * Contract every SMS driver must satisfy.
 *
 * The rest of the app only ever sees this interface via `SmsService` —
 * provider details (endpoints, templates, line numbers) stay inside the driver.
 */

/** Minimal delivery result the facade records in SmsLog. */
export interface SmsSendResult {
  /** Provider message id (sms.ir: data.messageId) — for delivery follow-up. */
  messageId?: number;
}

export interface SmsDriver {
  /** Deliver an OTP code (template/verify endpoint on most providers). */
  sendOtp(phone: string, code: string): Promise<SmsSendResult | void>;
  /** Deliver a free-text notification. */
  sendText(phone: string, text: string): Promise<SmsSendResult | void>;
}
