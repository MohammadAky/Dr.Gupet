import { Children, useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** Native touch scrolling; pointer dragging only supplements precise mouse input. */
export function LandingCarousel({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; scroll: number; pointer: number; started: boolean } | null>(
    null,
  );
  const suppressClick = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = useState(false);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const count = Children.count(children);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => {
      const extent = Math.max(0, element.scrollWidth - element.clientWidth);
      const position = Math.abs(element.scrollLeft);
      const style = getComputedStyle(element);
      const rtl = style.direction === 'rtl';
      const tolerance = (padding: string) => Math.max(2, (Number.parseFloat(padding) || 0) + 1);
      const start = tolerance(
        style.paddingInlineStart || (rtl ? style.paddingRight : style.paddingLeft),
      );
      const end = tolerance(
        style.paddingInlineEnd || (rtl ? style.paddingLeft : style.paddingRight),
      );
      // Native scroll snapping can rest a fraction of a padded edge away from zero.
      const previous = position > start;
      const next = position < extent - end;
      setEdges((current) =>
        current.previous === previous && current.next === next ? current : { previous, next },
      );
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
    };
  }, [count]);

  function scrollPage(direction: -1 | 1, instant = false) {
    const element = viewport.current;
    if (!element) return;
    const rtl = getComputedStyle(element).direction === 'rtl';
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    element.scrollBy({
      left: direction * (rtl ? -1 : 1) * element.clientWidth,
      behavior: reduced || instant ? 'instant' : 'smooth',
    });
  }

  function release() {
    const state = drag.current;
    if (state && viewport.current?.hasPointerCapture?.(state.pointer))
      viewport.current.releasePointerCapture(state.pointer);
    drag.current = null;
    setDragging(false);
    releaseTimer.current = setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  return (
    <div className="landing-carousel">
      <div className="landing-carousel__controls" aria-label={`کنترل فهرست ${title}`}>
        <button
          type="button"
          aria-label={`موارد قبلی ${title}`}
          aria-controls={id}
          disabled={!edges.previous}
          onClick={(event) => scrollPage(-1, event.detail === 0)}
        >
          →
        </button>
        <button
          type="button"
          aria-label={`موارد بعدی ${title}`}
          aria-controls={id}
          disabled={!edges.next}
          onClick={(event) => scrollPage(1, event.detail === 0)}
        >
          ←
        </button>
      </div>
      <div
        ref={viewport}
        id={id}
        className="landing-carousel__viewport"
        dir="rtl"
        role="group"
        aria-label={title}
        tabIndex={0}
        data-dragging={dragging}
        onDragStart={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
          const element = viewport.current;
          if (!element) return;
          const rtl = getComputedStyle(element).direction === 'rtl';
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            scrollPage(event.key === 'ArrowLeft' ? (rtl ? 1 : -1) : rtl ? -1 : 1, true);
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            element.scrollTo({
              left:
                event.key === 'Home'
                  ? 0
                  : (rtl ? -1 : 1) * (element.scrollWidth - element.clientWidth),
              behavior: 'instant',
            });
          }
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;
          if (releaseTimer.current) clearTimeout(releaseTimer.current);
          suppressClick.current = false;
          drag.current = {
            x: event.clientX,
            scroll: event.currentTarget.scrollLeft,
            pointer: event.pointerId,
            started: false,
          };
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state || state.pointer !== event.pointerId) return;
          if (event.buttons === 0) {
            release();
            return;
          }
          const delta = event.clientX - state.x;
          if (!state.started && Math.abs(delta) < 8) return;
          if (!state.started) {
            state.started = true;
            suppressClick.current = true;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            setDragging(true);
          }
          event.preventDefault();
          event.currentTarget.scrollLeft = state.scroll - delta;
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={() => {
          drag.current = null;
          setDragging(false);
        }}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }
        }}
      >
        {Children.map(children, (child) => (
          <div className="landing-carousel__item">{child}</div>
        ))}
      </div>
    </div>
  );
}
