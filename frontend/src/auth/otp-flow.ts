const PHONE_KEY = 'drgupet.otpPhone';

/** Keep the number for the OTP step without adding it to browser history or URLs. */
export function storeOtpPhone(phone: string): void {
  try {
    window.sessionStorage.setItem(PHONE_KEY, phone);
  } catch {
    // Router state still carries the number for this navigation.
  }
}

export function readOtpPhone(): string | null {
  try {
    return window.sessionStorage.getItem(PHONE_KEY);
  } catch {
    return null;
  }
}

export function clearOtpPhone(): void {
  try {
    window.sessionStorage.removeItem(PHONE_KEY);
  } catch {
    // Storage may be unavailable.
  }
}
