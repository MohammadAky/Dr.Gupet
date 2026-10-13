// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';
import { Dialog } from './ui/interactive';
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
function confirmButton() { return [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((button) => button.textContent === 'حذف آدرس')!; }
it('waits for success, blocks duplicate confirmation and prevents Escape dismissal during writes', async () => {
  let finish!: () => void;
  const onConfirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const onClose = vi.fn();
  await act(async () => root.render(<ConfirmDialog open title="حذف خانه" confirmLabel="حذف آدرس" onClose={onClose} onConfirm={onConfirm} />));
  await act(async () => { confirmButton().click(); confirmButton().click(); });
  expect(onConfirm).toHaveBeenCalledOnce();
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(onClose).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"] [aria-busy]')?.getAttribute('aria-busy')).toBe('true');
  await act(async () => finish());
  expect(onClose).toHaveBeenCalledOnce();
});
it('keeps failed confirmation open for retry and restores focus on cancellation', async () => {
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  const onClose = vi.fn();
  await act(async () => root.render(<ConfirmDialog open title="حذف خانه" confirmLabel="حذف آدرس" onClose={onClose} onConfirm={() => Promise.reject(new Error('دوباره تلاش کنید'))} />));
  await act(async () => confirmButton().click());
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('دوباره تلاش کنید');
  expect(onClose).not.toHaveBeenCalled();
  expect(confirmButton().disabled).toBe(false);
  await act(async () => root.render(<ConfirmDialog open={false} title="حذف خانه" onClose={onClose} onConfirm={() => {}} />));
  expect(document.activeElement).toBe(trigger); trigger.remove();
});
it('makes the app inert, contains keyboard focus and restores its previous state', async () => {
  container.id = 'root'; container.inert = false;
  await act(async () => root.render(<Dialog open title="بررسی" dismissible={false} onClose={() => {}}><button>ادامه</button></Dialog>));
  const panel = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(container.inert).toBe(true);
  expect(document.activeElement).toBe(panel);
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement?.textContent).toBe('ادامه');
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement?.textContent).toBe('ادامه');
  await act(async () => root.render(null));
  expect(container.inert).toBe(false);
});

it('wraps focus around visible enabled tab stops, skipping hidden and programmatic-only controls', async () => {
  await act(async () => root.render(<Dialog open title="بررسی" onClose={() => {}}>
    <input type="hidden" />
    <a href="/account" tabIndex={-1}>پیوند برنامه‌ای</a>
    <div style={{ display: 'none' }}><button>پنهان</button></div>
    <button disabled tabIndex={0}>غیرفعال</button>
    <button data-testid="last">ادامه</button>
  </Dialog>));
  const close = document.querySelector<HTMLButtonElement>('.ui-dialog__close')!;
  const last = document.querySelector<HTMLButtonElement>('[data-testid="last"]')!;
  expect(document.activeElement).toBe(close);
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(last);
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(close);
});
