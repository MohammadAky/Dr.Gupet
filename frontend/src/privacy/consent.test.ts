// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_STORAGE_KEY, readConsent, saveConsent } from './consent';

describe('first-visit cookie notice', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it('shows again when no current choice is saved', () => {
    expect(readConsent()).toBeNull();
  });

  it.each(['accepted', 'denied'] as const)(
    'records the %s choice with version and time',
    (choice) => {
      expect(saveConsent(choice)).toBe(true);
      expect(readConsent()).toMatchObject({ version: 2, choice });
      expect(readConsent()?.savedAt).toBeTruthy();
    },
  );

  it('rejects malformed and previous-version records', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, '{broken');
    expect(readConsent()).toBeNull();
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        choice: 'accepted',
        savedAt: new Date().toISOString(),
      }),
    );
    expect(readConsent()).toBeNull();
  });

  it('does not dismiss the notice when storage fails', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    expect(saveConsent('accepted')).toBe(false);
    expect(readConsent()).toBeNull();
    write.mockRestore();
  });
});
