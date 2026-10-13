// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { landingSample, type LandingContent } from '../features/landing/content';
import { LandingBanner } from './LandingBanner';

describe('manual landing banner interaction and motion', () => {
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
  }
  async function tick(milliseconds = 65000) {
    await act(async () => vi.advanceTimersByTime(milliseconds));
  }

  it('has only previous, next and slide dots, and never rotates automatically', async () => {
    await show();
    expect(container.querySelectorAll('button')).toHaveLength(landingSample.slides.length + 2);
    expect(container.querySelector('.landing-banner__play')).toBeNull();
    expect(button('بنر قبلی').textContent).toBe('→');
    expect(button('بنر بعدی').textContent).toBe('←');
    expect(vi.getTimerCount()).toBe(0);
    await tick();
    expect(title()).toBe(landingSample.slides[0]!.title);
    await click('بنر بعدی');
    await tick();
    expect(title()).toBe(landingSample.slides[1]!.title);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps an accessible region, polite heading updates and a real catalog action', async () => {
    await show();
    expect(banner().getAttribute('role')).toBe('region');
    expect(banner().getAttribute('aria-label')).toBe('بنرهای دکتر گوپت');
    const copy = container.querySelector('.landing-banner__copy')!;
    expect(copy.getAttribute('aria-live')).toBe('polite');
    expect(copy.getAttribute('aria-atomic')).toBe('true');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/products');
    expect(container.querySelector('.sr-only')?.textContent).toBe(landingSample.slides[0]!.alt);
    await click('بنر بعدی');
    expect(title()).toBe(landingSample.slides[1]!.title);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('.sr-only')?.textContent).toBe(landingSample.slides[1]!.alt);
    expect(copy.getAttribute('aria-live')).toBe('polite');
  });

  it('changes instantly for keyboard activation and fades for pointer activation', async () => {
    await show();
    await click('بنر بعدی');
    expect(title()).toBe(landingSample.slides[1]!.title);
    expect(banner().dataset.motion).toBe('instant');
    await click('بنر قبلی', true);
    expect(title()).toBe(landingSample.slides[0]!.title);
    expect(banner().dataset.motion).toBe('fade');
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
    expect(banner().dataset.motion).toBe('fade');
    reduced = true;
    await act(async () => mediaListeners.forEach((listener) => listener()));
    expect(banner().dataset.motion).toBe('instant');
    await click('بنر بعدی', true);
    expect(banner().dataset.motion).toBe('instant');
    reduced = false;
    await act(async () => mediaListeners.forEach((listener) => listener()));
    await click('بنر بعدی', true);
    expect(banner().dataset.motion).toBe('fade');
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
    expect(container.querySelector('a')).toBeNull();
    const source = container.querySelector('source')!;
    expect(source.getAttribute('srcset')).toBe('/brand/mobile.webp');
    expect(source.getAttribute('media')).toBe('(max-width: 760px)');
    content.slides[0]!.href = 'javascript:alert(1)';
    await show(content);
    expect(container.querySelector('a')).toBeNull();
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
