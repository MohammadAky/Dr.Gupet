// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QuantityField, parseQuantityInput } from './QuantityField';
let container: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
function Controlled({ change = () => {} }: { change?: (value: string) => void }) {
  const [value, setValue] = useState('1');
  return <QuantityField id="qty" value={value} max={20} onChange={next => { setValue(next); change(next); }} />;
}
const input = () => container.querySelector<HTMLInputElement>('input')!;
async function edit(value: string, caret = value.length) {
  await act(async () => {
    input().focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
    input().setSelectionRange(caret, caret); input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
it('normalizes Persian/Arabic digits without changing caret or inventing a cap of ten', async () => {
  const change = vi.fn(); await act(async () => root.render(<Controlled change={change} />));
  await edit('۲۰', 1); expect(input().value).toBe('20'); expect(input().selectionStart).toBe(1); expect(change).toHaveBeenLastCalledWith('20');
  expect(input().getAttribute('aria-invalid')).toBe('false');
  await edit('١٥'); expect(input().value).toBe('15'); expect(change).toHaveBeenLastCalledWith('15');
  expect(input().type).toBe('text'); expect(input().inputMode).toBe('numeric');
  expect(container.querySelectorAll('datalist option')).toHaveLength(20);
});
it.each(['', '0', '21', '-1', '1.5', '1e1', '+2', '1,000', ' 2 '])('retains invalid draft %j and connects its visible error', async draft => {
  await act(async () => root.render(<Controlled />)); await edit(draft);
  expect(input().value).toBe(draft); expect(input().getAttribute('aria-invalid')).toBe('true');
  expect(container.querySelector('#qty-error')?.textContent).toContain('۲۰');
  expect(input().getAttribute('aria-describedby')).toBe('qty-error'); expect(parseQuantityInput(draft, 20)).toBeNull();
});
it('forwards Cart blur/Enter and externally described errors without adding duplicate error copy', async () => {
  const blur = vi.fn(), key = vi.fn();
  await act(async () => root.render(<QuantityField id="cart-qty" label={false} ariaLabel="تعداد غذای سگ" value="2" max={20} onChange={vi.fn()}
    onBlur={blur} onKeyDown={key} invalid describedBy="server-error" />));
  await act(async () => { input().focus(); input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); input().blur(); });
  expect(blur).toHaveBeenCalledTimes(1); expect(key).toHaveBeenCalledTimes(1);
  expect(input().getAttribute('aria-label')).toBe('تعداد غذای سگ'); expect(input().getAttribute('aria-describedby')).toBe('server-error');
  expect(input().getAttribute('aria-invalid')).toBe('true'); expect(container.querySelector('[role="alert"]')).toBeNull();
});
it('uses the supplied API limit instead of fixing the validation range to a UI suggestion count', () => {
  expect(parseQuantityInput('۹۹', 99)).toBe(99); expect(parseQuantityInput('100', 99)).toBeNull(); expect(parseQuantityInput(String(Number.MAX_SAFE_INTEGER + 1), Number.MAX_SAFE_INTEGER + 1)).toBeNull();
});
