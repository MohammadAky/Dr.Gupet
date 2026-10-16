import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { storefrontApi, validPopup } from '../api/endpoints-storefront';
import { useConsent } from '../privacy/useConsent';
import { Dialog } from './ui';
import { SafeImage } from './SafeImage';
import '../styles/visit-popup.css';

const VISIT_KEY = 'drgupet.popup.visit.v1';
let memorySeen = false;
function seenInVisit() {
  if (memorySeen) return true;
  try {
    memorySeen = sessionStorage.getItem(VISIT_KEY) === 'seen';
    return memorySeen;
  }
  catch { return memorySeen; }
}
function markVisit() {
  memorySeen = true;
  try { sessionStorage.setItem(VISIT_KEY, 'seen'); } catch { /* In-memory fallback for this document. */ }
}

/** One dismissible homepage announcement per tab visit, after the cookie choice. */
export function VisitPopup() {
  const { pathname } = useLocation();
  const consent = useConsent();
  const [visitSeen, setVisitSeen] = useState(seenInVisit);
  const seen = useRef(visitSeen);
  const [open, setOpen] = useState(false);
  const eligible = pathname === '/' && Boolean(consent) && !visitSeen;
  const popup = useQuery({ queryKey: ['storefront', 'popup'], queryFn: storefrontApi.popup, enabled: eligible, retry: false, staleTime: 60_000 });
  const content = validPopup(popup.data) ? popup.data : null;

  useEffect(() => {
    // A displayed popup is consumed even when navigation, rather than its close
    // button, dismisses it. Reset open so browser Back cannot reveal it again.
    if (pathname !== '/') queueMicrotask(() => setOpen(false));
  }, [pathname]);

  useEffect(() => {
    if (!eligible || !content || seen.current) return;
    // Wait until first-entry loading has left the screen; never hide the initial notice.
    let cancelled = false;
    let observer: MutationObserver | undefined;
    const reveal = () => {
      if (cancelled || seen.current || document.querySelector('.landing-bootstrap')) return;
      queueMicrotask(() => {
        if (cancelled || seen.current) return;
        seen.current = true;
        markVisit();
        setVisitSeen(true);
        setOpen(true);
        observer?.disconnect();
      });
    };
    if (document.querySelector('.landing-bootstrap')) {
      observer = new MutationObserver(reveal);
      observer.observe(document.body, { childList: true, subtree: true });
    } else reveal();
    return () => { cancelled = true; observer?.disconnect(); };
  }, [eligible, content]);

  if (!content) return null;
  return <Dialog open={open && pathname === '/'} title={content.title} onClose={() => setOpen(false)}>
    <div className="visit-popup">
      {content.image && <SafeImage src={content.image} alt="" width="800" height="480" />}
      <p>{content.body}</p>
      <button className="ui-button ui-button--primary" type="button" onClick={() => setOpen(false)}>متوجه شدم</button>
    </div>
  </Dialog>;
}
