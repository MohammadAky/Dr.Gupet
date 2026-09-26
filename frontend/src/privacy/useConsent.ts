import { useEffect, useState } from 'react';
import { CONSENT_CHANGED_EVENT, CONSENT_STORAGE_KEY, readConsent } from './consent';

/** Re-read on changes from this tab and other tabs. */
export function useConsent() {
  const [consent, setConsent] = useState(readConsent);

  useEffect(() => {
    const refresh = () => setConsent(readConsent());
    const onStorage = (event: StorageEvent) => {
      if (event.key === CONSENT_STORAGE_KEY || event.key === null) refresh();
    };
    window.addEventListener(CONSENT_CHANGED_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return consent;
}
