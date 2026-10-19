// @vitest-environment jsdom
import { act, StrictMode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog, Tabs } from './interactive';

function TabsExample() {
  const [activeId, setActiveId] = useState('first');
  return (
    <Tabs
      label="تب‌های نمونه"
      activeId={activeId}
      onChange={setActiveId}
      items={[
        { id: 'first', label: 'معرفی', content: <p>محتوای اول</p> },
        { id: 'second', label: 'جزئیات', content: <p>محتوای دوم</p> },
        { id: 'third', label: 'غیرفعال', content: null, disabled: true },
      ]}
    />
  );
}

describe('tab accessibility relationships', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<TabsExample />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('keeps each aria-controls target in the DOM and exposes only the selected panel', async () => {
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = tabs.map((tab) => {
      const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
      return panel;
    });

    expect(panels).toHaveLength(3);
    expect(panels[0]?.hidden).toBe(false);
    expect(panels[1]?.hidden).toBe(true);
    expect(panels[2]?.hidden).toBe(true);
    expect(panels[1]?.textContent).toBe('');

    await act(async () => tabs[1]?.click());

    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(panels[0]?.hidden).toBe(true);
    expect(panels[1]?.hidden).toBe(false);
    expect(panels[1]?.textContent).toContain('محتوای دوم');
    expect(panels[0]?.textContent).toBe('');
    expect(tabs[2]?.disabled).toBe(true);
  });
});

describe('shared modal stack', () => {
  let container: HTMLDivElement;
  let root: Root;
  let trigger: HTMLButtonElement;
  const closeLower = vi.fn(),
    closeUpper = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    container = document.createElement('div');
    container.id = 'root';
    container.inert = false;
    document.body.append(container);
    trigger = document.createElement('button');
    trigger.textContent = 'گالری محصول';
    document.body.append(trigger);
    trigger.focus();
    root = createRoot(container);
    document.body.style.overflow = 'scroll';
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    trigger.remove();
    document.body.style.overflow = '';
    vi.unstubAllGlobals();
  });
  const key = (value: string, shiftKey = false) =>
    act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true }),
      );
    });
  function Pair({
    lower,
    upper,
    dismissible = true,
  }: {
    lower: boolean;
    upper: boolean;
    dismissible?: boolean;
  }) {
    return (
      <>
        <Dialog open={lower} title="گالری محصول" onClose={closeLower}>
          <button data-testid="lower">تصویر بعدی</button>
        </Dialog>
        <Dialog
          open={upper}
          title="تأیید انتقال سبد"
          onClose={closeUpper}
          dismissible={dismissible}
        >
          <button data-testid="upper">تأیید انتقال</button>
        </Dialog>
      </>
    );
  }
  const panels = () => [...document.querySelectorAll<HTMLDivElement>('[role="dialog"]')];

  it('lets only the newest overlapping dialog handle Escape and restores focus and locks one layer at a time', async () => {
    await act(async () => root.render(<Pair lower upper={false} />));
    const lowerAction = document.querySelector<HTMLButtonElement>('[data-testid="lower"]')!;
    await act(async () => lowerAction.focus());
    // Represents a delayed global confirmation mounting over an already-open gallery.
    await act(async () => root.render(<Pair lower upper />));
    const [lower, upper] = panels();
    expect(lower!.parentElement!.inert).toBe(true);
    expect(lower!.parentElement!.getAttribute('aria-hidden')).toBe('true');
    expect(lower!.getAttribute('aria-modal')).toBe('false');
    expect(upper!.getAttribute('aria-modal')).toBe('true');
    expect(Number(upper!.parentElement!.style.zIndex)).toBeGreaterThan(
      Number(lower!.parentElement!.style.zIndex),
    );
    const upperClose = upper!.querySelector<HTMLButtonElement>('.ui-dialog__close')!;
    expect(document.activeElement).toBe(upperClose);
    await key('Tab', true);
    expect(document.activeElement).toBe(document.querySelector('[data-testid="upper"]'));
    await key('Tab');
    expect(document.activeElement).toBe(upperClose);
    await key('Escape');
    expect(closeUpper).toHaveBeenCalledTimes(1);
    expect(closeLower).not.toHaveBeenCalled();
    await act(async () => root.render(<Pair lower upper={false} />));
    expect(container.inert).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(lower!.parentElement!.inert).toBe(false);
    expect(lower!.parentElement!.hasAttribute('aria-hidden')).toBe(false);
    expect(document.activeElement).toBe(lowerAction);
    await key('Escape');
    expect(closeLower).toHaveBeenCalledTimes(1);
    await act(async () => root.render(<Pair lower={false} upper={false} />));
    expect(container.inert).toBe(false);
    expect(document.body.style.overflow).toBe('scroll');
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the last lock and focus when a lower dialog disappears before the top one', async () => {
    await act(async () => root.render(<Pair lower upper />));
    const upperAction = document.querySelector<HTMLButtonElement>('[data-testid="upper"]')!;
    await act(async () => upperAction.focus());
    await act(async () => root.render(<Pair lower={false} upper />));
    expect(panels()).toHaveLength(1);
    expect(container.inert).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(upperAction);
    expect(panels()[0]!.parentElement!.inert).toBe(false);
    await key('Escape');
    expect(closeUpper).toHaveBeenCalledTimes(1);
    expect(closeLower).not.toHaveBeenCalled();
    await act(async () => root.render(<Pair lower={false} upper={false} />));
    expect(container.inert).toBe(false);
    expect(document.body.style.overflow).toBe('scroll');
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps Escape, backdrop and focus within a non-dismissible top dialog', async () => {
    await act(async () => root.render(<Pair lower upper dismissible={false} />));
    const upper = panels()[1]!;
    expect(document.activeElement).toBe(upper);
    await key('Escape');
    await act(async () =>
      document
        .querySelectorAll<HTMLDivElement>('.ui-dialog__backdrop')
        .forEach((backdrop) => backdrop.click()),
    );
    await act(async () =>
      panels()[0]!.querySelector<HTMLButtonElement>('.ui-dialog__close')!.click(),
    );
    expect(closeLower).not.toHaveBeenCalled();
    expect(closeUpper).not.toHaveBeenCalled();
    await act(async () => trigger.focus());
    expect(upper.contains(document.activeElement)).toBe(true);
    await key('Tab');
    expect(document.activeElement).toBe(document.querySelector('[data-testid="upper"]'));
  });

  it.each([false, true])(
    'restores the original root inert=%s and overflow after simultaneous StrictMode cleanup',
    async (inert) => {
      container.inert = inert;
      await act(async () =>
        root.render(
          <StrictMode>
            <Pair lower upper />
          </StrictMode>,
        ),
      );
      expect(container.inert).toBe(true);
      expect(document.body.style.overflow).toBe('hidden');
      expect(panels()[1]!.contains(document.activeElement)).toBe(true);
      await act(async () => root.render(null));
      expect(panels()).toHaveLength(0);
      expect(container.inert).toBe(inert);
      expect(document.body.style.overflow).toBe('scroll');
      expect(document.activeElement).toBe(trigger);
    },
  );
});
