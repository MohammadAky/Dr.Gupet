import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { landingSample, safeLandingLink, type LandingContent } from '../features/landing/content';
import { toFaDigits } from '../lib/format';
import { SafeImage } from './SafeImage';
import '../styles/landing-banner.css';

export function LandingBanner({ content = landingSample }: { content?: LandingContent }) {
  const slides = content.slides.filter((slide) => slide.enabled);
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  const [motion, setMotion] = useState<'instant' | 'fade'>('instant');
  const root = useRef<HTMLElement>(null);
  const active = Math.min(index, Math.max(0, slides.length - 1));
  const slide = slides[active];
  useLayoutEffect(() => {
    const measure = () => {
      if (!root.current) return;
      // Route entrance translates the parent visually; viewport height must use normal layout.
      let offset = 0;
      let element: HTMLElement | null = root.current;
      while (element) {
        offset += element.offsetTop;
        element = element.offsetParent as HTMLElement | null;
      }
      root.current.style.setProperty('--landing-header-height', `${Math.max(0, offset)}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    document
      .querySelectorAll('.announcement, .app-header, .site-header, .header')
      .forEach((el) => observer?.observe(el));
    void document.fonts?.ready.then(measure);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduced(media?.matches ?? false);
      if (media?.matches) setMotion('instant');
    };
    media?.addEventListener?.('change', update);
    return () => {
      media?.removeEventListener?.('change', update);
    };
  }, []);
  function select(next: number, keyboard: boolean) {
    setMotion(keyboard || reduced ? 'instant' : 'fade');
    setIndex((next + slides.length) % slides.length);
  }
  if (!slide)
    return (
      <section className="landing-banner landing-banner--empty">
        <h1>همراه حیوان خانگی شما</h1>
        <Link to="/products">مشاهدهٔ محصولات</Link>
      </section>
    );
  return (
    <section
      ref={root}
      className="landing-banner"
      data-motion={motion}
      role="region"
      aria-roledescription="اسلایدر"
      aria-label="بنرهای دکتر گوپت"
    >
      <div className="landing-banner__art" aria-hidden="true">
        {slides.map((item, position) => (
          <picture
            key={item.id}
            className={position === active ? 'is-active' : ''}
            style={
              {
                '--desktop-focus': `${item.desktopFocus.x}% ${item.desktopFocus.y}%`,
                '--mobile-focus': `${item.mobileFocus.x}% ${item.mobileFocus.y}%`,
              } as CSSProperties
            }
          >
            {item.mobileImage && <source media="(max-width: 760px)" srcSet={item.mobileImage} />}
            <SafeImage
              className="landing-banner__image"
              src={item.image}
              alt=""
              width="1600"
              height="700"
              decoding="async"
              loading={position === 0 ? 'eager' : 'lazy'}
              fetchPriority={position === 0 ? 'high' : 'auto'}
            />
          </picture>
        ))}
      </div>
      <div className="landing-banner__copy" aria-live="polite" aria-atomic="true">
        <div className="landing-banner__text" key={slide.id}>
          <p className="landing-banner__eyebrow">برای همراه دوست‌داشتنی شما</p>
          <h1>{slide.title}</h1>
          <p>{slide.description}</p>
        </div>
        {safeLandingLink(slide.href) && slide.href && (
          <Link className="button-primary" to={slide.href}>
            {slide.ctaLabel}
            <span aria-hidden="true">←</span>
          </Link>
        )}
      </div>
      {slides.length > 1 && (
        <div className="landing-banner__controls" aria-label="کنترل بنر">
          <button
            type="button"
            aria-label="بنر قبلی"
            onClick={(event) => select(active - 1, event.detail === 0)}
          >
            →
          </button>
          <div className="landing-banner__dots" role="group" aria-label="انتخاب بنر">
            {slides.map((item, position) => (
              <button
                key={item.id}
                type="button"
                aria-label={`بنر ${toFaDigits(String(position + 1))}: ${item.title}`}
                aria-pressed={position === active}
                onClick={(event) => select(position, event.detail === 0)}
              >
                <span />
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="بنر بعدی"
            onClick={(event) => select(active + 1, event.detail === 0)}
          >
            ←
          </button>
        </div>
      )}
      <span className="sr-only">{slide.alt}</span>
    </section>
  );
}
