/**
 * Contract every SMS driver must satisfy.
 *
 * The rest of the app only ever sees this interface via `SmsService` —
 * provider details (endpoints, templates, line numbers) stay inside the driver.
 */
export interface SmsDriver {
  /** Deliver an OTP code (template/verify endpoint on most providers). */
  sendOtp(phone: string, code: string): Promise<void>;
  /** Deliver a free-text notification. */
  sendText(phone: string, text: string): Promise<void>;
}
