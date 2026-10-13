// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingCarousel } from './LandingCarousel';

describe('compact landing carousel navigation', () => {
  let container: HTMLDivElement;
  let root: Root;
  let scroller: HTMLDivElement;
  let visit: () => void;

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    visit = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () =>
      root.render(
        <LandingCarousel title="محصولات نمونه">
          {Array.from({ length: 6 }, (_, index) => (
            <a
              href="/products"
              key={index}
              onClick={(event) => {
                event.preventDefault();
                visit();
              }}
            >
              محصول {index + 1}
            </a>
          ))}
        </LandingCarousel>,
      ),
    );
    scroller = container.querySelector('.landing-carousel__viewport')!;
    scroller.style.direction = 'rtl';
    Object.defineProperty(scroller, 'clientWidth', { value: 320 });
    Object.defineProperty(scroller, 'scrollWidth', { value: 1000 });
    scroller.scrollBy = vi.fn();
    scroller.scrollTo = vi.fn();
    scroller.setPointerCapture = vi.fn();
    scroller.hasPointerCapture = vi.fn(() => true);
    scroller.releasePointerCapture = vi.fn();
    await act(async () => scroller.dispatchEvent(new Event('scroll')));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function button(direction: 'previous' | 'next') {
    return container.querySelectorAll<HTMLButtonElement>('.landing-carousel__controls button')[
      direction === 'previous' ? 0 : 1
    ]!;
  }
  function pointer(type: string, x: number, pointerType = 'mouse', buttons = 1) {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      button: 0,
      buttons,
    });
    Object.defineProperties(event, {
      pointerType: { value: pointerType },
      pointerId: { value: 1 },
      isPrimary: { value: true },
    });
    scroller.dispatchEvent(event);
  }

  it('shows six cards with named arrows and disables navigation at RTL boundaries', async () => {
    expect(container.querySelectorAll('.landing-carousel__item')).toHaveLength(6);
    expect(scroller.getAttribute('aria-label')).toBe('محصولات نمونه');
    expect(button('previous').disabled).toBe(true);
    expect(button('next').disabled).toBe(false);
    expect(button('next').getAttribute('aria-controls')).toBe(scroller.id);
    await act(async () => {
      scroller.scrollLeft = -680;
      scroller.dispatchEvent(new Event('scroll'));
    });
    expect(button('previous').disabled).toBe(false);
    expect(button('next').disabled).toBe(true);
  });

  it('scrolls a viewport toward later RTL cards on a pointer arrow click', async () => {
    await act(async () =>
      button('next').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })),
    );
    expect(scroller.scrollBy).toHaveBeenCalledWith({ left: -320, behavior: 'smooth' });
  });

  it('treats fractional snap offsets within padding as boundaries while allowing real progress', async () => {
    scroller.style.paddingInlineStart = '3.2px';
    scroller.style.paddingInlineEnd = '3.2px';
    await act(async () => {
      scroller.scrollLeft = -3.2;
      scroller.dispatchEvent(new Event('scroll'));
    });
    expect(button('previous').disabled).toBe(true);
    expect(button('next').disabled).toBe(false);
    await act(async () => {
      scroller.scrollLeft = -8;
      scroller.dispatchEvent(new Event('scroll'));
    });
    expect(button('previous').disabled).toBe(false);
    await act(async () => {
      scroller.scrollLeft = -676.8;
      scroller.dispatchEvent(new Event('scroll'));
    });
    expect(button('next').disabled).toBe(true);
  });

  it('makes keyboard arrows and keyboard button activation instant', async () => {
    await act(async () =>
      scroller.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })),
    );
    expect(scroller.scrollBy).toHaveBeenLastCalledWith({ left: -320, behavior: 'instant' });
    await act(async () => button('next').click());
    expect(scroller.scrollBy).toHaveBeenLastCalledWith({ left: -320, behavior: 'instant' });
    await act(async () =>
      scroller.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })),
    );
    expect(scroller.scrollTo).toHaveBeenCalledWith({ left: -680, behavior: 'instant' });
  });

  it('honors reduced motion for pointer navigation too', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    await act(async () =>
      button('next').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })),
    );
    expect(scroller.scrollBy).toHaveBeenCalledWith({ left: -320, behavior: 'instant' });
  });

  it('preserves browser and system shortcuts modified with Control, Meta, Alt or Shift', async () => {
    for (const shortcut of [
      { key: 'Home', ctrlKey: true },
      { key: 'End', metaKey: true },
      { key: 'ArrowLeft', altKey: true },
      { key: 'ArrowRight', shiftKey: true },
    ]) {
      const event = new KeyboardEvent('keydown', { ...shortcut, bubbles: true, cancelable: true });
      await act(async () => scroller.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(false);
    }
    expect(scroller.scrollTo).not.toHaveBeenCalled();
    expect(scroller.scrollBy).not.toHaveBeenCalled();
  });

  it('preserves ordinary links under the mouse threshold and suppresses a click after a real drag', async () => {
    await act(async () => {
      pointer('pointerdown', 100);
      pointer('pointermove', 104);
      pointer('pointerup', 104, 'mouse', 0);
      container.querySelector('a')!.click();
    });
    expect(visit).toHaveBeenCalledTimes(1);
    await act(async () => {
      pointer('pointerdown', 100);
      pointer('pointermove', 135);
      pointer('pointerup', 135, 'mouse', 0);
      container.querySelector('a')!.click();
    });
    expect(scroller.scrollLeft).toBe(-35);
    expect(visit).toHaveBeenCalledTimes(1);
    expect(scroller.setPointerCapture).toHaveBeenCalledWith(1);
    expect(scroller.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('leaves touch scrolling to the browser and releases cancelled mouse gestures', async () => {
    await act(async () => {
      pointer('pointerdown', 100, 'touch');
      pointer('pointermove', 140, 'touch');
    });
    expect(scroller.scrollLeft).toBe(0);
    expect(scroller.setPointerCapture).not.toHaveBeenCalled();
    await act(async () => {
      pointer('pointerdown', 100);
      pointer('pointermove', 120);
      pointer('pointercancel', 120, 'mouse', 0);
    });
    expect(scroller.dataset.dragging).toBe('false');
    await act(async () => {
      pointer('pointermove', 180);
    });
    expect(scroller.scrollLeft).toBe(-20);
  });
});
