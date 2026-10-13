// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JalaliDateInput } from './JalaliDateInput';

let container: HTMLDivElement; let root: Root;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const click = async (selector: string) => { const control = container.querySelector<HTMLButtonElement>(selector); expect(control).toBeTruthy(); await act(async () => control!.click()); };
const key = async (control: Element, value: string) => { await act(async () => control.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }))); };
function Example({ value = '2026-03-21', max, withTime = false, change = () => {} }: { value?: string; max?: string; withTime?: boolean; change?(value: string): void }) {
  const [date, setDate] = useState(value);
  return <form><label htmlFor="birthday">تاریخ شمسی</label><JalaliDateInput id="birthday" name="birthday" value={date} max={max} withTime={withTime} onChange={next => { setDate(next); change(next); }} /></form>;
}
it('shows Persian dates, a Saturday-first month, no native Gregorian controls, and restores focus on Escape', async () => {
  await act(async () => root.render(<Example />));
  expect(container.querySelector('#birthday')?.textContent).toContain('۱ فروردین ۱۴۰۵');
  expect(container.querySelector('input[type=date],input[type=datetime-local]')).toBeNull();
  await click('#birthday');
  expect(document.activeElement?.getAttribute('data-day')).toBe('2026-03-21');
  expect(container.querySelectorAll('[data-day]')).toHaveLength(31);
  await key(document.activeElement!, 'Escape');
  expect(container.querySelector('[aria-label="تقویم شمسی"]')).toBeNull();
  expect(document.activeElement?.id).toBe('birthday');
});
it('chooses a day as the unchanged ISO API day and blocks future birth dates', async () => {
  const change = vi.fn(); await act(async () => root.render(<Example max="2026-03-22" change={change} />));
  await click('#birthday');
  expect(container.querySelector<HTMLButtonElement>('[data-day="2026-03-23"]')?.disabled).toBe(true);
  await click('[data-day="2026-03-23"]'); expect(change).not.toHaveBeenCalled();
  await click('[data-day="2026-03-22"]'); expect(change).toHaveBeenCalledWith('2026-03-22');
  expect(container.querySelector('#birthday')?.textContent).toContain('۲ فروردین ۱۴۰۵');
});
it('supports RTL arrow and month/year keyboard navigation without selecting an uncommitted date', async () => {
  const change = vi.fn(); await act(async () => root.render(<Example change={change} />)); await click('#birthday');
  await key(document.activeElement!, 'ArrowLeft'); expect(document.activeElement?.getAttribute('data-day')).toBe('2026-03-22');
  await key(document.activeElement!, 'PageUp'); expect(container.querySelector('[aria-label="ماه شمسی"]')?.getAttribute('aria-label')).toBeTruthy();
  expect(container.querySelector('.jalali-date__month')?.textContent).toBe('اسفند ۱۴۰۴');
  expect(container.querySelectorAll('[data-day]')).toHaveLength(29);
  expect(change).not.toHaveBeenCalled();
});
it('preserves the exact coupon instant when opened and changes only an explicitly selected Tehran date', async () => {
  const change = vi.fn(); await act(async () => root.render(<Example value="2026-10-08T08:30:37.123Z" withTime change={change} />));
  await click('#birthday'); expect(change).not.toHaveBeenCalled();
  await click('[data-day="2026-10-08"]'); expect(change).not.toHaveBeenCalled();
  await click('[data-day="2026-10-09"]'); expect(change).toHaveBeenCalledWith('2026-10-09T08:30:00.000Z');
  expect(container.querySelector('#birthday')?.textContent).toContain('۱۷ مهر ۱۴۰۵، ۱۲:۰۰');
});
it('emits the existing form draft signal on actual changes and exposes clear only for populated values', async () => {
  const input = vi.fn(); container.addEventListener('input', input);
  const change = vi.fn(); await act(async () => root.render(<Example change={change} />)); await click('#birthday');
  await click('[data-day="2026-03-22"]'); expect(input).toHaveBeenCalledTimes(1);
  await click('#birthday');
  const clear = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'پاک کردن تاریخ')!;
  await act(async () => clear.click()); expect(change).toHaveBeenLastCalledWith('');
  expect(container.querySelector('#birthday')?.textContent).toContain('انتخاب تاریخ شمسی');
});
