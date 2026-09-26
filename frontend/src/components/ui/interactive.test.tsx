// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from './interactive';

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
