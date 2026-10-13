// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { landingSample, type LandingContent } from '../features/landing/content';
import { LandingBanner } from './LandingBanner';

describe('cyclic landing banner interaction and motion', () => {
  let container: HTMLDivElement;
  let root: Root;
  let mounted: boolean;
  let reduced: boolean;
  let mediaListeners: Set<() => void>;
  let resizeCallback: ResizeObserverCallback;
  let disconnect: ReturnType<typeof vi.fn>;
  let observed: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 360, bottom: 600, width: 360, height: 600, toJSON: () => ({}) });
    reduced = false;
    mounted = true;
    mediaListeners = new Set();
    disconnect = vi.fn();
    observed = vi.fn();
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return reduced;
      },
      addEventListener: (_name: string, listener: () => void) => mediaListeners.add(listener),
      removeEventListener: (_name: string, listener: () => void) => mediaListeners.delete(listener),
    }));
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }
        observe = observed;
        disconnect = disconnect;
      },
    );
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function show(content?: LandingContent) {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <LandingBanner content={content} />
        </MemoryRouter>,
      ),
    );
  }
  function button(label: string) {
    const found = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.getAttribute('aria-label') === label,
    );
    expect(found, 'Expected button ' + label).toBeTruthy();
    return found!;
  }
  function title() {
    return container.querySelector('h1')?.textContent;
  }
  function banner() {
    return container.querySelector<HTMLElement>('.landing-banner')!;
  }
  async function click(label: string, pointer = false) {
    await act(async () =>
      button(label).dispatchEvent(
        new MouseEvent('click', { bubbles: true, detail: pointer ? 1 : 0 }),
      ),
    );
    if (pointer) await tick(1000);
  }
  async function tick(milliseconds = 65000) {
    await act(async () => vi.advanceTimersByTime(milliseconds));
  }
  async function point(type: string, x: number, y: number, options: { id?: number; kind?: string; target?: Element; buttons?: number } = {}) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: options.buttons ?? 1 });
    Object.defineProperties(event, {
      pointerId: { value: options.id ?? 1 }, pointerType: { value: options.kind ?? 'touch' },
      isPrimary: { value: (options.id ?? 1) === 1 },
    });
    await act(async () => (options.target ?? banner()).dispatchEvent(event));
    return event;
  }

  it('retains only arrows/dots and automatically cycles through the real slide count forever', async () => {
    await show();
    expect(container.querySelectorAll('button')).toHaveLength(landingSample.slides.length + 2);
    expect(container.querySelector('.landing-banner__play')).toBeNull();
    expect(button('بنر قبلی').textContent).toBe('→');
    expect(button('بنر بعدی').textContent).toBe('←');
    expect(vi.getTimerCount()).toBe(1);
    await tick(6999);
    expect(title()).toBe(landingSample.slides[0]!.title);
    await tick(1);
    expect(container.querySelector('.landing-banner__copy')?.getAttribute('aria-live')).toBe('off');
    await tick(1000);
    expect(title()).toBe(landingSample.slides[1]!.title);
    await tick(8000);
    expect(title()).toBe(landingSample.slides[2]!.title);
    await tick(8000);
    expect(title()).toBe(landingSample.slides[0]!.title);
  });

  it('keeps an accessible region, polite heading updates and a real catalog action', async () => {
    await show();
    expect(banner().getAttribute('role')).toBe('region');
    expect(banner().getAttribute('aria-label')).toBe('بنرهای دکتر گوپت');
    const copy = container.querySelector('.landing-banner__copy')!;
    expect(copy.getAttribute('aria-live')).toBe('off');
    expect(copy.getAttribute('aria-atomic')).toBe('true');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/products');
    expect(container.querySelector('.sr-only')?.textContent).toBe(landingSample.slides[0]!.alt);
    await click('بنر بعدی');
    expect(title()).toBe(landingSample.slides[1]!.title);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('.sr-only')?.textContent).toBe(landingSample.slides[1]!.alt);
    expect(copy.getAttribute('aria-live')).toBe('polite');
  });

  it('changes instantly for keyboard activation and settles physically for pointer activation', async () => {
    await show();
    await click('بنر بعدی');
    expect(title()).toBe(landingSample.slides[1]!.title);
    expect(banner().dataset.motion).toBe('instant');
    await click('بنر قبلی', true);
    expect(title()).toBe(landingSample.slides[0]!.title);
    expect(banner().dataset.motion).toBe('slide');
    await click('بنر قبلی');
    expect(title()).toBe(landingSample.slides[2]!.title);
    expect(banner().dataset.motion).toBe('instant');
    expect(
      container.querySelectorAll('.landing-banner__dots button[aria-pressed="true"]'),
    ).toHaveLength(1);
  });

  it('wraps previous and next controls while retaining keyboard focus', async () => {
    await show();
    const previous = button('بنر قبلی');
    await act(async () => previous.focus());
    await click('بنر قبلی');
    expect(title()).toBe(landingSample.slides.at(-1)!.title);
    expect(document.activeElement).toBe(previous);
    const next = button('بنر بعدی');
    await act(async () => next.focus());
    await click('بنر بعدی');
    expect(title()).toBe(landingSample.slides[0]!.title);
    expect(document.activeElement).toBe(next);
  });

  it('uses named dots to select any of twelve slides without adding play controls', async () => {
    const content = structuredClone(landingSample);
    content.slides = Array.from({ length: 12 }, (_, index) => ({
      ...content.slides[0]!,
      id: 'banner-' + index,
      title: 'اسلاید ' + (index + 1),
    }));
    await show(content);
    expect(container.querySelectorAll('.landing-banner__dots button')).toHaveLength(12);
    expect(container.querySelector('.landing-banner__dots')?.getAttribute('aria-label')).toBe(
      'انتخاب بنر',
    );
    await click('بنر ۱۲: اسلاید 12');
    expect(title()).toBe('اسلاید 12');
    expect(banner().dataset.motion).toBe('instant');
    expect(button('بنر ۱۲: اسلاید 12').getAttribute('aria-pressed')).toBe('true');
    expect(
      container.querySelectorAll('.landing-banner__dots button[aria-pressed="true"]'),
    ).toHaveLength(1);
    expect(container.querySelectorAll('button')).toHaveLength(14);
  });

  it('autoplays past the last of twelve configured slides and ignores disabled entries', async () => {
    const content = structuredClone(landingSample);
    content.slides = Array.from({ length: 12 }, (_, index) => ({ ...content.slides[0]!, id: `dynamic-${index}`, title: `dynamic ${index}`, enabled: index !== 4 }));
    await show(content);
    expect(container.querySelectorAll('.landing-banner__dots button')).toHaveLength(11);
    for (const expected of [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 0]) {
      await tick(8000);
      expect(title()).toBe(`dynamic ${expected}`);
    }
    expect(container.querySelectorAll('[data-banner-slot]')).toHaveLength(3);
  });

  it('tracks a touch swipe directly and loops previous from the first slide to the last', async () => {
    await show();
    const capture = vi.fn(); banner().setPointerCapture = capture;
    await point('pointerdown', 100, 200); await tick(20);
    const move = await point('pointermove', 230, 202);
    expect(move.defaultPrevented).toBe(true);
    expect(capture).toHaveBeenCalledWith(1);
    expect(container.querySelector<HTMLElement>('[data-banner-slot="0"]')!.style.transform).toContain('+ 130px');
    await tick(200); await point('pointerup', 230, 202); await tick(1000);
    expect(title()).toBe(landingSample.slides.at(-1)!.title);
    expect(container.querySelector<HTMLElement>('[data-banner-slot="0"]')!.style.transform).toContain('+ 0px');
    expect(banner().hasAttribute('data-dragging')).toBe(false);
    await tick(30000); expect(title()).toBe(landingSample.slides.at(-1)!.title);
  });

  it('supports desktop mouse dragging and keeps a released mouse from sticking to the pointer', async () => {
    await show(); await point('pointerdown', 250, 200, { kind: 'mouse' }); await tick(20);
    await point('pointermove', 100, 200, { kind: 'mouse' }); await tick(200);
    await point('pointerup', 100, 200, { kind: 'mouse', buttons: 0 }); await tick(1000);
    expect(title()).toBe(landingSample.slides[1]!.title);
    await point('pointerdown', 250, 200, { kind: 'mouse' });
    await point('pointermove', 100, 200, { kind: 'mouse' });
    await point('pointermove', 80, 200, { kind: 'mouse', buttons: 0 }); await tick(1000);
    expect(title()).toBe(landingSample.slides[1]!.title);
    expect(banner().hasAttribute('data-dragging')).toBe(false);
  });

  it('preserves native vertical scrolling and returns a short drag without changing the slide', async () => {
    await show(); await point('pointerdown', 200, 200);
    const move = await point('pointermove', 198, 340);
    expect(move.defaultPrevented).toBe(false);
    await point('pointerup', 198, 340); await tick(1000);
    expect(title()).toBe(landingSample.slides[0]!.title);
    await point('pointerdown', 200, 200); await tick(20);
    await point('pointermove', 180, 200); await tick(200);
    await point('pointerup', 180, 200); await tick(1000);
    expect(title()).toBe(landingSample.slides[0]!.title);
  });

  it('keeps CTA/control taps separate and suppresses the synthetic click after a drag', async () => {
    await show();
    const action = container.querySelector('a')!;
    await point('pointerdown', 200, 200, { target: action });
    await point('pointermove', 50, 200, { target: action });
    expect(banner().hasAttribute('data-dragging')).toBe(false);
    await point('pointerdown', 200, 200); await point('pointermove', 50, 200);
    await point('pointerup', 50, 200); await tick(1000);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    await act(async () => action.dispatchEvent(click)); expect(click.defaultPrevented).toBe(true);
    await point('pointerdown', 200, 200, { target: action });
    const intentional = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    let received = false; action.addEventListener('click', () => { received = true; });
    await act(async () => action.dispatchEvent(intentional)); expect(received).toBe(true);
  });

  it('cancels lost capture and ignores a second touch while another pointer is dragging', async () => {
    await show(); await point('pointerdown', 200, 200); await point('pointermove', 80, 200);
    await point('pointerdown', 300, 200, { id: 2 }); await point('pointermove', 340, 200, { id: 2 });
    expect(container.querySelector<HTMLElement>('[data-banner-slot="0"]')!.style.transform).toContain('+ -120px');
    await point('lostpointercapture', 80, 200); await tick(1000);
    expect(title()).toBe(landingSample.slides[0]!.title);
    await point('pointerdown', 200, 200); await point('pointermove', 80, 200);
    await point('pointercancel', 80, 200); await tick(1000);
    expect(title()).toBe(landingSample.slides[0]!.title);
  });

  it('keeps a touch drag when a child relinquishes implicit capture to the banner', async () => {
    await show(); await point('pointerdown', 240, 200, { target: container.querySelector('h1')! });
    await point('pointermove', 80, 200);
    await point('lostpointercapture', 80, 200, { target: container.querySelector('h1')! });
    expect(banner().hasAttribute('data-dragging')).toBe(true);
    await tick(200); await point('pointerup', 80, 200); await tick(1000);
    expect(title()).toBe(landingSample.slides[1]!.title);
  });

  it('pauses autoplay while hovered/hidden and stops it after keyboard focus or manual navigation', async () => {
    await show(); await act(async () => banner().dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    await tick(30000); expect(title()).toBe(landingSample.slides[0]!.title);
    await act(async () => banner().dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
    await tick(8000); expect(title()).toBe(landingSample.slides[1]!.title);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await tick(30000); expect(title()).toBe(landingSample.slides[1]!.title);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await tick(8000); expect(title()).toBe(landingSample.slides[2]!.title);
    await act(async () => button('بنر بعدی').focus());
    await act(async () => button('بنر بعدی').blur());
    await tick(30000); expect(title()).toBe(landingSample.slides[2]!.title);
    await click('بنر بعدی'); await tick(30000); expect(title()).toBe(landingSample.slides[0]!.title);
  });

  it('keeps previous and next physical directions distinct with exactly two enabled slides', async () => {
    const content = structuredClone(landingSample); content.slides = content.slides.slice(0, 2);
    await show(content);
    await act(async () => button('بنر قبلی').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
    await tick(100);
    expect(container.querySelector<HTMLElement>('[data-banner-slot="0"]')!.style.transform).toMatch(/\+ [\d.]+px/);
    await tick(1000); expect(title()).toBe(content.slides[1]!.title);
    await act(async () => button('بنر بعدی').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
    await tick(100);
    expect(container.querySelector<HTMLElement>('[data-banner-slot="0"]')!.style.transform).toContain('+ -');
    await tick(1000); expect(title()).toBe(content.slides[0]!.title);
  });

  it('pauses automatic rotation when the banner leaves the viewport and cleans its observer', async () => {
    let intersection!: IntersectionObserverCallback;
    const disconnectVisibility = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { intersection = callback; }
      observe = vi.fn(); disconnect = disconnectVisibility;
    });
    await show();
    await act(async () => intersection([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    await tick(30000); expect(title()).toBe(landingSample.slides[0]!.title);
    await act(async () => intersection([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await tick(8000); expect(title()).toBe(landingSample.slides[1]!.title);
    await act(async () => root.unmount()); mounted = false;
    expect(disconnectVisibility).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels an old-width drag and spring on orientation/viewport changes', async () => {
    await show(); await point('pointerdown', 240, 200); await point('pointermove', 70, 200);
    await point('pointerup', 70, 200); await tick(100);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 180, bottom: 600, width: 180, height: 600, toJSON: () => ({}) });
    await act(async () => window.dispatchEvent(new Event('resize')));
    expect(container.querySelector<HTMLElement>('[data-banner-slot="0"]')!.style.transform).toContain('+ 0px');
    await tick(1000); expect(title()).toBe(landingSample.slides[0]!.title);
    await point('pointerdown', 150, 200); await point('pointermove', 40, 200);
    await act(async () => window.dispatchEvent(new Event('resize')));
    expect(banner().hasAttribute('data-dragging')).toBe(false);
    await point('pointerup', 40, 200); await tick(1000);
    expect(title()).toBe(landingSample.slides[0]!.title);
  });

  it('stays inside the rendered neighbor bounds during a very fast flick and can be grabbed mid-spring', async () => {
    await show(); await point('pointerdown', 340, 200); await tick(20);
    await point('pointermove', 60, 200); await point('pointerup', 60, 200);
    for (let frame = 0; frame < 6; frame += 1) {
      await tick(16);
      const transform = container.querySelector<HTMLElement>('[data-banner-slot="0"]')!.style.transform;
      const value = Number(transform.match(/\+ (-?[\d.]+)px/)?.[1]);
      expect(Math.abs(value)).toBeLessThanOrEqual(360);
    }
    const before = container.querySelector<HTMLElement>('[data-banner-slot="0"]')!.style.transform;
    await point('pointerdown', 100, 200);
    expect(container.querySelector<HTMLElement>('[data-banner-slot="0"]')!.style.transform).toBe(before);
    await point('pointercancel', 100, 200); await tick(1000);
    expect(title()).toBe(landingSample.slides[0]!.title);
  });

  it('clears in-flight gestures/springs when slides shrink or reduced motion changes live', async () => {
    await show(); await point('pointerdown', 200, 200); await point('pointermove', 80, 200);
    const content = structuredClone(landingSample); content.slides = content.slides.slice(0, 1);
    await show(content); await point('pointerup', 80, 200); await tick(1000);
    expect(title()).toBe(content.slides[0]!.title); expect(vi.getTimerCount()).toBe(0);
    await show(); await point('pointerdown', 200, 200); await point('pointermove', 80, 200);
    reduced = true; await act(async () => mediaListeners.forEach(listener => listener()));
    expect(banner().hasAttribute('data-dragging')).toBe(false);
    await tick(30000); expect(title()).toBe(landingSample.slides[0]!.title);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('removes pointer motion when reduced motion is initially requested', async () => {
    reduced = true;
    await show();
    await click('بنر بعدی', true);
    expect(title()).toBe(landingSample.slides[1]!.title);
    expect(banner().dataset.motion).toBe('instant');
    await tick();
    expect(title()).toBe(landingSample.slides[1]!.title);
  });

  it('responds to live reduced-motion changes and removes its media listener on unmount', async () => {
    await show();
    await click('بنر بعدی', true);
    expect(banner().dataset.motion).toBe('slide');
    reduced = true;
    await act(async () => mediaListeners.forEach((listener) => listener()));
    expect(banner().dataset.motion).toBe('instant');
    await click('بنر بعدی', true);
    expect(banner().dataset.motion).toBe('instant');
    reduced = false;
    await act(async () => mediaListeners.forEach((listener) => listener()));
    await click('بنر بعدی', true);
    expect(banner().dataset.motion).toBe('slide');
    await act(async () => root.unmount());
    mounted = false;
    expect(mediaListeners.size).toBe(0);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retains a catalog action when no slide is enabled and omits controls for one slide', async () => {
    const content = structuredClone(landingSample);
    content.slides.forEach((item) => {
      item.enabled = false;
    });
    await show(content);
    expect(title()).toBe('همراه حیوان خانگی شما');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/products');
    expect(container.querySelector('button')).toBeNull();
    content.slides[0]!.enabled = true;
    await show(content);
    expect(title()).toBe(landingSample.slides[0]!.title);
    expect(container.querySelector('button')).toBeNull();
  });

  it('clamps an old selection to a valid slide when the content shrinks', async () => {
    await show();
    await click('بنر قبلی');
    const content = structuredClone(landingSample);
    content.slides = content.slides.slice(0, 1);
    await show(content);
    expect(title()).toBe(content.slides[0]!.title);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('button')).toBeNull();
  });

  it('rejects unsafe CTA destinations and switches to the dedicated mobile picture source', async () => {
    const content = structuredClone(landingSample);
    content.slides[0]!.href = '//outside.example';
    content.slides[0]!.mobileImage = '/brand/mobile.webp';
    await show(content);
    expect(container.querySelector('[data-banner-slot="0"] a')).toBeNull();
    const source = container.querySelector('source')!;
    expect(source.getAttribute('srcset')).toBe('/brand/mobile.webp');
    expect(source.getAttribute('media')).toBe('(max-width: 760px)');
    content.slides[0]!.href = 'javascript:alert(1)';
    await show(content);
    expect(container.querySelector('[data-banner-slot="0"] a')).toBeNull();
  });

  it('retains heading and manual navigation when an image fails', async () => {
    await show();
    const first = container.querySelector('img')!;
    expect(first.getAttribute('alt')).toBe('');
    expect(first.getAttribute('width')).toBe('1600');
    expect(first.getAttribute('height')).toBe('700');
    expect(first.getAttribute('fetchpriority')).toBe('high');
    await act(async () => first.dispatchEvent(new Event('error')));
    const fallback = container.querySelector('.safe-image-fallback')!;
    expect(fallback.getAttribute('aria-hidden')).toBe('true');
    expect((fallback as HTMLElement).style.width).toBe('');
    expect((fallback as HTMLElement).style.height).toBe('');
    expect(title()).toBe(landingSample.slides[0]!.title);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/products');
    await click('بنر بعدی');
    expect(title()).toBe(landingSample.slides[1]!.title);
  });

  it('measures normal layout despite the route entrance transform and observes actual header resizing', async () => {
    const header = document.createElement('header');
    header.className = 'app-header';
    document.body.prepend(header);
    const main = document.createElement('main');
    main.className = 'app-main';
    document.body.append(main);
    main.append(container);
    let parentOffset = 110;
    const childOffset = 60;
    vi.stubGlobal('scrollY', 40);
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this === main
        ? parentOffset
        : this.classList.contains('landing-banner')
          ? childOffset
          : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this === main
        ? document.body
        : this.classList.contains('landing-banner')
          ? main
          : null;
    });
    // Rect includes both scrolling and the +6px route animation; neither belongs in header height.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: parentOffset + childOffset - window.scrollY + 6,
      top: parentOffset + childOffset - window.scrollY + 6,
      left: 0,
      right: 1280,
      bottom: parentOffset + childOffset - window.scrollY + 706,
      width: 1280,
      height: 700,
      toJSON: () => ({}),
    }));
    try {
      await show();
      expect(observed).toHaveBeenCalledWith(header);
      expect(banner().style.getPropertyValue('--landing-header-height')).toBe('170px');
      parentOffset = 160;
      await act(async () => resizeCallback([], {} as ResizeObserver));
      expect(banner().style.getPropertyValue('--landing-header-height')).toBe('220px');
      await act(async () => root.unmount());
      mounted = false;
      expect(disconnect).toHaveBeenCalledOnce();
    } finally {
      header.remove();
      main.remove();
    }
  });
});
