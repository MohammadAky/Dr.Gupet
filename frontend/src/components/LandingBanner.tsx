import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { flushSync } from 'react-dom';
import { landingSample, safeLandingLink, type LandingContent } from '../features/landing/content';
import { bannerSpring, bannerStep } from '../features/landing/banner-motion';
import { toFaDigits } from '../lib/format';
import { SafeImage } from './SafeImage';
import { landingImageSet } from '../lib/landing-image';
import '../styles/landing-banner.css';

const ROTATION_MS = 7000;
type Gesture = {
  id: number; x: number; y: number; offset: number; horizontal: boolean;
  samples: { x: number; time: number }[];
};

export function LandingBanner({ content = landingSample }: { content?: LandingContent }) {
  const slides = content.slides.filter((slide) => slide.enabled);
  const contentKey = slides.map((slide) => slide.id).join('\0');
  const hasSlides = slides.length > 0;
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [motion, setMotion] = useState<'instant' | 'fade' | 'slide'>('instant');
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [onScreen, setOnScreen] = useState(true);
  const [manual, setManual] = useState(false);
  const root = useRef<HTMLElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef<number | null>(null);
  const offset = useRef(0);
  const measuredWidth = useRef(0);
  const velocity = useRef(0);
  const suppressClick = useRef(false);
  const mounted = useRef(true);
  const active = Math.min(index, Math.max(0, slides.length - 1));
  const slide = slides[active];
  const rotating = slides.length > 1 && !manual && !reduced && !hovered && !focused && !interacting && visible && onScreen;

  const present = useCallback((value: number) => {
    offset.current = value;
    root.current?.querySelectorAll<HTMLElement>('[data-banner-slot]').forEach((panel) => {
      panel.style.transform = `translate3d(calc(${Number(panel.dataset.bannerSlot) * 100}% + ${value}px), 0, 0)`;
    });
  }, []);
  const stopSpring = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const releaseCapture = useCallback((id: number) => {
    if (root.current?.hasPointerCapture?.(id)) root.current.releasePointerCapture(id);
  }, []);
  const finish = useCallback((next: number) => {
    stopSpring(); velocity.current = 0;
    // Commit the incoming slide before resetting the track, avoiding a frame of the old slide.
    flushSync(() => { setIndex(next); setInteracting(false); });
    present(0);
  }, [present, stopSpring]);
  const settle = useCallback((step: -1 | 0 | 1, startVelocity: number) => {
    stopSpring();
    if (slides.length < 2) { present(0); setInteracting(false); return; }
    const next = (active + step + slides.length) % slides.length;
    const width = measuredWidth.current;
    if (reduced || width <= 0) { setMotion('instant'); finish(next); return; }
    setMotion('slide'); setInteracting(true);
    const target = -step * width;
    const start = offset.current;
    const startedAt = performance.now();
    function animate(time: number) {
      if (!mounted.current) return;
      const seconds = Math.max(0, (time - startedAt) / 1000);
      const value = bannerSpring(start, target, startVelocity, seconds);
      const bounded = Math.max(-width, Math.min(width, value.position));
      velocity.current = bounded === value.position ? value.velocity : 0;
      present(bounded);
      if (seconds >= 1 || (Math.abs(value.position - target) < 0.4 && Math.abs(value.velocity) < 4)) finish(next);
      else frame.current = requestAnimationFrame(animate);
    }
    frame.current = requestAnimationFrame(animate);
  }, [active, finish, present, reduced, slides.length, stopSpring]);
  function select(next: number, keyboard: boolean, step?: -1 | 1) {
    setManual(true); stopSpring();
    const destination = (next + slides.length) % slides.length;
    if (keyboard || reduced) { setMotion('instant'); finish(destination); }
    else if (step) settle(step, velocity.current);
    else if (destination === (active + 1) % slides.length) settle(1, velocity.current);
    else if (destination === (active - 1 + slides.length) % slides.length) settle(-1, velocity.current);
    else { setMotion('fade'); finish(destination); }
  }
  function pointerDown(event: PointerEvent<HTMLElement>) {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0) || gesture.current) return;
    suppressClick.current = false;
    if (slides.length < 2 || (event.target as Element).closest('a, button, input, select, textarea, [contenteditable="true"]')) return;
    stopSpring(); setMotion('instant'); setInteracting(true);
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: offset.current, horizontal: false, samples: [{ x: event.clientX, time: performance.now() }] };
  }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) { pointerEnd(event, true); return; }
    const x = event.clientX - current.x; const y = event.clientY - current.y;
    if (!current.horizontal) {
      if (Math.max(Math.abs(x), Math.abs(y)) < 10) return;
      if (Math.abs(y) >= Math.abs(x)) { gesture.current = null; settle(0, 0); return; }
      current.horizontal = true; setManual(true); root.current?.setPointerCapture?.(event.pointerId);
      root.current?.setAttribute('data-dragging', 'true');
    }
    event.preventDefault();
    const now = performance.now();
    current.samples = [...current.samples, { x: event.clientX, time: now }].filter(sample => now - sample.time <= 100).slice(-5);
    const width = measuredWidth.current;
    present(Math.max(-width, Math.min(width, current.offset + x)));
  }
  function pointerEnd(event: PointerEvent<HTMLElement>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null; root.current?.removeAttribute('data-dragging'); releaseCapture(event.pointerId);
    if (!current.horizontal) { settle(0, 0); return; }
    suppressClick.current = true;
    const now = performance.now();
    const samples = [...current.samples, { x: event.clientX, time: now }].filter(sample => now - sample.time <= 100);
    const first = samples[0]!; const last = samples.at(-1)!;
    const speed = last.time > first.time ? ((last.x - first.x) / (last.time - first.time)) * 1000 : 0;
    const width = measuredWidth.current;
    settle(cancelled ? 0 : bannerStep(offset.current, width, speed), cancelled ? 0 : speed);
  }

  useLayoutEffect(() => {
    let measureFrame: number | null = null;
    let disposed = false;
    const measure = () => {
      measureFrame = null;
      if (!root.current) return;
      measuredWidth.current = root.current.getBoundingClientRect().width;
      let offset = 0; let element: HTMLElement | null = root.current;
      while (element) { offset += element.offsetTop; element = element.offsetParent as HTMLElement | null; }
      const height = `${Math.max(0, offset)}px`;
      if (root.current.style.getPropertyValue('--landing-header-height') !== height) root.current.style.setProperty('--landing-header-height', height);
    };
    const scheduleMeasure = () => {
      if (!disposed && measureFrame === null) measureFrame = requestAnimationFrame(measure);
    };
    const resize = () => {
      stopSpring(); present(0); velocity.current = 0;
      const pointer = gesture.current; gesture.current = null;
      if (pointer) releaseCapture(pointer.id);
      root.current?.removeAttribute('data-dragging'); setInteracting(false);
      scheduleMeasure();
    };
    measure(); window.addEventListener('resize', resize);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    document.querySelectorAll('.announcement, .app-header, .site-header, .header').forEach(el => observer?.observe(el));
    if (root.current) observer?.observe(root.current);
    void document.fonts?.ready.then(scheduleMeasure);
    return () => { disposed = true; if (measureFrame !== null) cancelAnimationFrame(measureFrame); window.removeEventListener('resize', resize); observer?.disconnect(); };
  }, [hasSlides, present, releaseCapture, stopSpring]);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduced(media?.matches ?? false);
      if (media?.matches) {
        stopSpring(); present(0); velocity.current = 0; setMotion('instant'); setInteracting(false);
        if (gesture.current) releaseCapture(gesture.current.id);
        gesture.current = null; root.current?.removeAttribute('data-dragging');
      }
    };
    const visibility = () => setVisible(!document.hidden);
    media?.addEventListener?.('change', update); document.addEventListener('visibilitychange', visibility);
    return () => { media?.removeEventListener?.('change', update); document.removeEventListener('visibilitychange', visibility); };
  }, [present, releaseCapture, stopSpring]);
  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry?.isIntersecting ?? false), { threshold: 0.15 });
    observer.observe(root.current); return () => observer.disconnect();
  }, [hasSlides]);
  useLayoutEffect(() => {
    stopSpring(); present(0); velocity.current = 0;
    if (gesture.current) releaseCapture(gesture.current.id);
    gesture.current = null; root.current?.removeAttribute('data-dragging');
    queueMicrotask(() => { if (mounted.current) setInteracting(false); });
  }, [contentKey, present, releaseCapture, stopSpring]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stopSpring(); if (gesture.current) releaseCapture(gesture.current.id); };
  }, [releaseCapture, stopSpring]);
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => { setManual(false); settle(1, 0); }, ROTATION_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, active, contentKey, settle]);

  if (!slide) return <section className="landing-banner landing-banner--empty"><h1>همراه حیوان خانگی شما</h1><Link to="/products">مشاهدهٔ محصولات</Link></section>;
  const panels = slides.length > 1 ? [0, -1, 1] : [0];
  return <section ref={root} className="landing-banner" data-motion={motion} role="region" aria-roledescription="اسلایدر" aria-label="بنرهای دکتر گوپت"
    onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => pointerEnd(event)} onPointerCancel={event => pointerEnd(event, true)}
    onLostPointerCapture={event => { if (event.target === event.currentTarget && gesture.current?.id === event.pointerId) pointerEnd(event, true); }}
    onPointerLeave={event => { if (gesture.current?.id === event.pointerId && !gesture.current.horizontal) pointerEnd(event, true); }}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => { setFocused(true); setManual(true); }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
    onDragStart={event => event.preventDefault()}
    onClickCapture={event => { if (suppressClick.current && event.detail > 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
    {panels.map(slot => {
      const item = slides[(active + slot + slides.length) % slides.length]!;
      return <div key={slot} className="landing-banner__slide" data-banner-slot={slot} style={{ transform: `translate3d(${slot * 100}%, 0, 0)` }} aria-hidden={slot !== 0 ? true : undefined} inert={slot !== 0}>
        <div className="landing-banner__art" aria-hidden="true"><picture style={{ '--desktop-focus': `${item.desktopFocus.x}% ${item.desktopFocus.y}%`, '--mobile-focus': `${item.mobileFocus.x}% ${item.mobileFocus.y}%` } as CSSProperties}>
          {item.mobileImage && <source media="(max-width: 760px)" srcSet={landingImageSet(item.mobileImage) ?? item.mobileImage} sizes="100vw" />}
          <SafeImage className="landing-banner__image" src={item.image} srcSet={landingImageSet(item.image)} sizes="100vw" alt="" width="1600" height="700" decoding="async" draggable={false} loading="eager" fetchPriority={slot === 0 ? 'high' : 'low'} />
        </picture></div>
        <div className="landing-banner__copy" aria-live={slot === 0 && manual ? 'polite' : 'off'} aria-atomic="true">
          <div className="landing-banner__text" key={item.id}><p className="landing-banner__eyebrow">برای همراه دوست‌داشتنی شما</p>
            {slot === 0 ? <h1>{item.title}</h1> : <h2>{item.title}</h2>}<p>{item.description}</p>
          </div>
          {safeLandingLink(item.href) && item.href && <Link className="button-primary" tabIndex={slot === 0 ? undefined : -1} to={item.href}>{item.ctaLabel}<span aria-hidden="true">←</span></Link>}
        </div>
      </div>;
    })}
    {slides.length > 1 && <div className="landing-banner__controls" aria-label="کنترل بنر">
      <button type="button" aria-label="بنر قبلی" onClick={event => select(active - 1, event.detail === 0, -1)}>→</button>
      <div className="landing-banner__dots" role="group" aria-label="انتخاب بنر">{slides.map((item, position) => <button key={item.id} type="button" aria-label={`بنر ${toFaDigits(String(position + 1))}: ${item.title}`} aria-pressed={position === active} onClick={event => select(position, event.detail === 0)}><span /></button>)}</div>
      <button type="button" aria-label="بنر بعدی" onClick={event => select(active + 1, event.detail === 0, 1)}>←</button>
    </div>}
    <span className="sr-only">{slide.alt}</span>
  </section>;
}
