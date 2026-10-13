// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
import { SearchableFilter } from './SearchableFilter';
it('keeps the active option in view, supports Home/End and preserves selection on Escape', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const select = vi.fn();
  try {
    await act(async () => root.render(<SearchableFilter label="نوع" value="a" options={[{ value:'a', label:'الف' }, { value:'b', label:'ب' }, { value:'c', label:'پ' }]} onSelect={select} />));
    const input = container.querySelector('input')!;
    await act(async () => input.focus());
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(input.getAttribute('aria-activedescendant')).toBe(container.querySelectorAll('[role="option"]')[2]!.id);
    expect(scroll).toHaveBeenLastCalledWith({ block:'nearest' });
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(input.getAttribute('aria-activedescendant')).toBe(container.querySelector('[role="option"]')!.id);
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(input.value).toBe('الف'); expect(select).not.toHaveBeenCalled(); expect(input.getAttribute('aria-controls')).toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView; vi.unstubAllGlobals(); }
});
