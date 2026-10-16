// @vitest-environment jsdom
import { act, useState } from 'react';
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
    expect(input.getAttribute('aria-activedescendant')).toBe(document.querySelectorAll('[role="option"]')[2]!.id);
    expect(scroll).toHaveBeenLastCalledWith({ block:'nearest' });
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(input.getAttribute('aria-activedescendant')).toBe(document.querySelector('[role="option"]')!.id);
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(input.value).toBe('الف'); expect(select).not.toHaveBeenCalled(); expect(input.getAttribute('aria-controls')).toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView; vi.unstubAllGlobals(); }
});
it('uses one whole control without a separate arrow button and preserves arbitrary address text', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const selected = vi.fn();
  function Example() {
    const [value, setValue] = useState('');
    return <><SearchableFilter id="province" showLabel={false} label="استان" value={value} options={[{ value: 'گیلان', label: 'گیلان' }, { value: 'تهران', label: 'تهران' }]}
      onInputChange={setValue} onSelect={next => { setValue(next); selected(next); }} /><button id="outside" type="button">بعدی</button></>;
  }
  try {
    await act(async () => root.render(<Example />));
    const input = container.querySelector<HTMLInputElement>('#province')!;
    expect(container.querySelector('.searchable-filter__control button')).toBeNull();
    expect(container.querySelector('.glass-chevron')?.getAttribute('aria-hidden')).toBe('true');
    await act(async () => {
      input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'گيلان'); input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(1);
    await act(async () => document.querySelector<HTMLElement>('[role="option"]')!.click());
    expect(selected).toHaveBeenCalledWith('گیلان'); expect(input.value).toBe('گیلان');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'شهر دلخواه'); input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.querySelector('[role="status"]')?.textContent).toContain('موردی پیدا نشد');
    await act(async () => container.querySelector<HTMLButtonElement>('#outside')!.focus());
    expect(input.value).toBe('شهر دلخواه'); expect(document.querySelector('[role="listbox"]')).toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});
it('keeps disabled/error semantics on the visible input and never opens while disabled', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(<SearchableFilter label="شهر" value="تهران" options={[{ value: 'تهران', label: 'تهران' }]} disabled aria-invalid aria-describedby="city-error" onSelect={vi.fn()} />));
    const input = container.querySelector('input')!;
    expect(input.disabled).toBe(true); expect(input.getAttribute('aria-invalid')).toBe('true'); expect(input.getAttribute('aria-describedby')).toBe('city-error');
    await act(async () => container.querySelector<HTMLElement>('.searchable-filter__control')!.click());
    expect(input.getAttribute('aria-expanded')).toBe('false'); expect(document.querySelector('[role="listbox"]')).toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});
