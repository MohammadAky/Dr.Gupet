import { useState } from 'react';
import { saveConsent } from './consent';
import { useConsent } from './useConsent';

/** One-time floating notice. Neither choice enables a third-party service. */
export function ConsentBanner() {
  const consent = useConsent();
  const [error, setError] = useState(false);

  if (consent) return null;

  return (
    <aside className="privacy-banner" lang="en" dir="ltr" aria-label="Cookie notice">
      <div className="privacy-banner-copy">
        <h2>Cookie notice</h2>
        <p>
          Essential browser storage supports sign-in and shopping. No analytics or advertising
          cookies are active. Deny declines optional cookies; either choice is saved in this
          browser. Any future optional service will require a new notice.
        </p>
      </div>
      <div className="privacy-actions">
        <button
          type="button"
          className="button-primary"
          onClick={() => setError(!saveConsent('accepted'))}
        >
          Accept Cookies
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={() => setError(!saveConsent('denied'))}
        >
          Deny Cookies
        </button>
      </div>
      {error && (
        <p role="status">Your choice could not be saved. No optional cookies are active.</p>
      )}
    </aside>
  );
}
