const PHONE_KEY = 'drgupet.otpPhone';
const COOLDOWN_KEY = 'drgupet.otpCooldown';

/** The resend deadline belongs to one number and survives a same-tab reload. */
export function storeOtpCooldown(phone: string, seconds: number): void {
  const validSeconds = Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : 60;
  try {
    window.sessionStorage.setItem(
      COOLDOWN_KEY,
      JSON.stringify({ phone, until: Date.now() + validSeconds * 1000 }),
    );
  } catch {
    // The verification route still works when session storage is unavailable.
  }
}

export function readOtpCooldown(phone: string): number {
  try {
    const stored = window.sessionStorage.getItem(COOLDOWN_KEY);
    if (!stored) return 0;
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== 'object') return 0;
    const { phone: storedPhone, until } = value as { phone?: unknown; until?: unknown };
    if (storedPhone !== phone || typeof until !== 'number' || !Number.isSafeInteger(until))
      return 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

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
    window.sessionStorage.removeItem(COOLDOWN_KEY);
  } catch {
    // Storage may be unavailable.
  }
}
