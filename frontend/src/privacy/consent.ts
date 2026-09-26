/**
 * This is a record of the first-visit notice choice, not permission for any
 * future analytics or advertising provider. No optional vendor is installed.
 * A new vendor requires a new disclosure and consent version before loading.
 */
export const CONSENT_VERSION = 2;
export const CONSENT_STORAGE_KEY = 'drgupet.cookieNotice.v2';
export const CONSENT_CHANGED_EVENT = 'drgupet:privacy-choices-changed';

export type NoticeChoice = 'accepted' | 'denied';

export interface NoticeRecord {
  version: typeof CONSENT_VERSION;
  choice: NoticeChoice;
  savedAt: string;
}

function isNoticeRecord(value: unknown): value is NoticeRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === CONSENT_VERSION &&
    (candidate.choice === 'accepted' || candidate.choice === 'denied') &&
    typeof candidate.savedAt === 'string' &&
    Number.isFinite(Date.parse(candidate.savedAt))
  );
}

/** Missing, invalid, or outdated records show the notice again. */
export function readConsent(): NoticeRecord | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isNoticeRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** A failed browser write leaves the notice visible; no optional services load. */
export function saveConsent(choice: NoticeChoice): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const record: NoticeRecord = {
      version: CONSENT_VERSION,
      choice,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}
