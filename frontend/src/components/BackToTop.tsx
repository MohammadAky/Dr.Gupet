import { useCallback, useEffect, useRef, useState } from 'react';
import '../styles/back-to-top.css';

export function BackToTop() {
  const [visible, setVisible] = useState(() => window.scrollY > 360);
  const scrollFrame = useRef<number | null>(null);
  const stopScroll = useCallback(() => {
    if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
  }, []);

  function returnToTop() {
    stopScroll();
    const start = Math.max(0, window.scrollY);
    if (!start || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      setVisible(false);
      return;
    }
    const started = performance.now();
    // Bound the journey even on long pages; explicit instant frame writes avoid
    // combining this easing with a browser/CSS smooth-scroll animation.
    function advance(now: number) {
      const progress = Math.min(1, Math.max(0, (now - started) / 360));
      const remaining = (1 - progress) ** 3;
      window.scrollTo({ top: start * remaining, behavior: 'instant' });
      if (progress < 1) scrollFrame.current = window.requestAnimationFrame(advance);
      else { scrollFrame.current = null; setVisible(false); }
    }
    scrollFrame.current = window.requestAnimationFrame(advance);
  }

  useEffect(() => {
    let frame: number | null = null;
    const update = () => {
      frame = null;
      setVisible(window.scrollY > 360);
    };
    const onScroll = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', stopScroll, { passive: true });
    window.addEventListener('touchstart', stopScroll, { passive: true });
    window.addEventListener('pointerdown', stopScroll, { passive: true });
    const onKey = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) stopScroll();
    };
    window.addEventListener('keydown', onKey);
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onPreference = () => {
      if (media?.matches && scrollFrame.current !== null) {
        stopScroll();
        window.scrollTo({ top: 0, behavior: 'instant' });
        setVisible(false);
      }
    };
    media?.addEventListener?.('change', onPreference);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', stopScroll);
      window.removeEventListener('touchstart', stopScroll);
      window.removeEventListener('pointerdown', stopScroll);
      window.removeEventListener('keydown', onKey);
      media?.removeEventListener?.('change', onPreference);
      if (frame !== null) window.cancelAnimationFrame(frame);
      stopScroll();
    };
  }, [stopScroll]);

  if (!visible) return null;
  return (
    <button className="back-to-top" type="button" aria-label="بازگشت به بالا"
      title="بازگشت به بالا" onClick={returnToTop}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="m6 11 6-6 6 6M12 5v14" />
      </svg>
    </button>
  );
}
