// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GlassSelect } from './GlassSelect';
import { Field } from './Field';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const trigger = () => host.querySelector<HTMLButtonElement>('button[role="combobox"]')!;
const list = () => document.querySelector<HTMLElement>('[role="listbox"]');
async function key(value: string) { await act(async () => trigger().dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))); }
async function option(value: string) {
  const row = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(item => item.dataset.value === value);
  expect(row).toBeTruthy(); await act(async () => row!.click());
}
function Example({ change = () => {}, disabled = false }: { change?(value: string): void; disabled?: boolean }) {
  const [value, setValue] = useState('a');
  return <form><label htmlFor="choice">نوع</label><GlassSelect id="choice" name="kind" disabled={disabled} value={value} onChange={event => { setValue(event.target.value); change(event.target.value); }}>
    <option value="a">الف</option><option value="disabled" disabled>غیرفعال</option><option value="b">ب</option><option value="c">پ</option>
  </GlassSelect><button type="submit">ذخیره</button></form>;
}

it('keeps the label and form value while exposing only the glass combobox as an interactive select', async () => {
  const change = vi.fn(); await act(async () => root.render(<Example change={change} />));
  const native = host.querySelector('select')!;
  expect(native.hidden).toBe(true); expect(native.getAttribute('aria-hidden')).toBe('true'); expect(native.tabIndex).toBe(-1);
  expect(trigger().id).toBe('choice'); expect(trigger().labels?.[0]?.textContent).toBe('نوع');
  expect(new FormData(host.querySelector('form')!).get('kind')).toBe('a');
  await act(async () => trigger().click());
  expect(list()?.parentElement).toBe(document.body);
  expect(trigger().getAttribute('aria-controls')).toBe(list()?.id);
  await option('b');
  expect(change).toHaveBeenCalledExactlyOnceWith('b'); expect(trigger().textContent).toContain('ب');
  expect(new FormData(host.querySelector('form')!).get('kind')).toBe('b'); expect(document.activeElement).toBe(trigger()); expect(list()).toBeNull();
});
it('skips disabled choices with arrows, supports Home/End and commits only on Enter', async () => {
  const change = vi.fn(); await act(async () => root.render(<Example change={change} />));
  await key('ArrowDown'); await key('ArrowDown');
  const active = document.getElementById(trigger().getAttribute('aria-activedescendant')!);
  expect(active?.dataset.value).toBe('b'); expect(change).not.toHaveBeenCalled();
  await key('End'); expect(document.getElementById(trigger().getAttribute('aria-activedescendant')!)?.dataset.value).toBe('c');
  await key('Home'); expect(document.getElementById(trigger().getAttribute('aria-activedescendant')!)?.dataset.value).toBe('a');
  await key('End'); await key('Enter'); expect(change).toHaveBeenCalledExactlyOnceWith('c'); expect(list()).toBeNull();
  await key('Home'); expect(document.getElementById(trigger().getAttribute('aria-activedescendant')!)?.dataset.value).toBe('a');
  await key('Escape'); await key('End'); expect(document.getElementById(trigger().getAttribute('aria-activedescendant')!)?.dataset.value).toBe('c');
});
it('does not select disabled/current options or submit the surrounding form when opening by keyboard', async () => {
  const change = vi.fn(); await act(async () => root.render(<Example change={change} />));
  const submit = vi.fn(event => event.preventDefault()); host.querySelector('form')!.addEventListener('submit', submit);
  await key(' '); await option('disabled'); expect(change).not.toHaveBeenCalled(); expect(list()).not.toBeNull();
  await option('a'); expect(change).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled();
});
it('closes on Escape without propagating to an outer dialog, and on outside pointer/Tab without committing', async () => {
  const change = vi.fn(), parent = vi.fn(); await act(async () => root.render(<div onKeyDown={parent}><Example change={change} /></div>));
  await act(async () => trigger().click()); await key('End'); parent.mockClear(); await key('Escape');
  expect(list()).toBeNull(); expect(parent).not.toHaveBeenCalled(); expect(change).not.toHaveBeenCalled();
  await act(async () => trigger().click()); await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(list()).toBeNull(); await act(async () => trigger().click()); await key('Tab'); expect(list()).toBeNull();
});
it('supports Persian and Arabic typeahead normalization and keeps active choices visible', async () => {
  const scroll = vi.fn(); Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
  try {
    await act(async () => root.render(<GlassSelect aria-label="سال" value="1404"><option value="1404">۱۴۰۴</option><option value="1405">۱۴۰۵</option></GlassSelect>));
    for (const character of '١٤٠٥') await key(character);
    expect(document.getElementById(trigger().getAttribute('aria-activedescendant')!)?.dataset.value).toBe('1405');
    expect(scroll).toHaveBeenLastCalledWith({ block: 'nearest' });
  } finally { delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView; }
});
it('connects Field errors to the visible control and sends browser required validation focus there', async () => {
  await act(async () => root.render(<form><Field label="حیوان" htmlFor="pet" error="انتخاب کنید"><GlassSelect id="pet" name="pet" value="" required><option value="">نامشخص</option><option value="cat">گربه</option></GlassSelect></Field></form>));
  expect(trigger().getAttribute('aria-invalid')).toBe('true'); expect(trigger().getAttribute('aria-describedby')).toBe('pet-error');
  expect(host.querySelector('[aria-invalid="true"]')).toBe(trigger());
  await act(async () => { expect(host.querySelector('select')!.checkValidity()).toBe(false); });
  expect(document.activeElement).toBe(trigger()); expect(trigger().getAttribute('aria-required')).toBe('true');
});
it('closes when disabled, stays closed when reenabled and excludes its value from disabled form data', async () => {
  await act(async () => root.render(<Example />)); await act(async () => trigger().click());
  await act(async () => root.render(<Example disabled />)); expect(list()).toBeNull(); expect(trigger().disabled).toBe(true);
  expect(new FormData(host.querySelector('form')!).has('kind')).toBe(false);
  await act(async () => root.render(<Example />)); expect(list()).toBeNull(); expect(trigger().disabled).toBe(false);
});
it('clamps the portal to the viewport and opens above a control near the bottom edge', async () => {
  vi.stubGlobal('innerWidth', 400); vi.stubGlobal('innerHeight', 400);
  await act(async () => root.render(<Example />));
  vi.spyOn(host.querySelector('.glass-select')!, 'getBoundingClientRect').mockReturnValue({ left: 350, top: 350, bottom: 398, width: 180, height: 48 } as DOMRect);
  await act(async () => trigger().click());
  expect(list()?.dataset.side).toBe('above'); expect(Number.parseFloat(list()!.style.left)).toBeLessThanOrEqual(208);
  expect(Number.parseFloat(list()!.style.maxHeight)).toBeLessThanOrEqual(300);
});
