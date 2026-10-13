// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TomanInput } from './TomanInput';

let container: HTMLDivElement; let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
function Controlled({ initial = '', change = () => {} }: { initial?: string; change?(value: string): void }) {
  const [value, setValue] = useState(initial);
  return <form><label htmlFor="price">قیمت (تومان)</label><TomanInput id="price" name="price" value={value} onValueChange={next => { setValue(next); change(next); }} /></form>;
}
const input = () => container.querySelector<HTMLInputElement>('input')!;
async function edit(value: string, start = value.length, end = start) {
  await act(async () => {
    input().focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
    input().setSelectionRange(start, end); input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
it('formats each typed/pasted amount, keeps caret and sends the same raw integer string', async () => {
  const change = vi.fn(); await act(async () => root.render(<Controlled change={change} />));
  await edit('123'); expect(input().value).toBe('۱۲۳'); expect(input().selectionStart).toBe(3);
  await edit('1234'); expect(input().value).toBe('۱٬۲۳۴'); expect(input().selectionStart).toBe(5);
  await edit('١٢٣,٠٠٠'); expect(input().value).toBe('۱۲۳٬۰۰۰'); expect(input().selectionStart).toBe(7);
  expect(change).toHaveBeenLastCalledWith('123000');
  await edit(''); expect(input().value).toBe(''); expect(change).toHaveBeenLastCalledWith('');
});
it('preserves middle insertion and selection ranges instead of moving editing to the end', async () => {
  await act(async () => root.render(<Controlled initial="123456" />));
  await edit('۱۲۹۳٬۴۵۶', 3); expect(input().value).toBe('۱٬۲۹۳٬۴۵۶'); expect(input().selectionStart).toBe(4);
  await edit('123456', 2, 5); expect(input().selectionStart).toBe(2); expect(input().selectionEnd).toBe(6);
  await edit('1256', 2); expect(input().value).toBe('۱٬۲۵۶'); expect(input().selectionStart).toBe(3);
});
it('makes Backspace/Delete across grouping separators actually delete a digit', async () => {
  const change = vi.fn(); await act(async () => root.render(<Controlled initial="1234" change={change} />));
  await act(async () => { input().focus(); input().setSelectionRange(2, 2); input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })); });
  expect(input().value).toBe('۲۳۴'); expect(input().selectionStart).toBe(0); expect(change).toHaveBeenLastCalledWith('234');
  await edit('1234');
  await act(async () => { input().setSelectionRange(1, 1); input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })); });
  expect(input().value).toBe('۱۳۴'); expect(input().selectionStart).toBe(1); expect(change).toHaveBeenLastCalledWith('134');
});
it('does not silently transform signs, decimals or exponents into another money value', async () => {
  const change = vi.fn(); await act(async () => root.render(<Controlled change={change} />));
  for (const value of ['-1000', '12.5', '1e3']) { await edit(value); expect(input().value).toBe(value); expect(change).toHaveBeenLastCalledWith(value); }
});
it('keeps native default-value form reset, browser FormData and disabled/ARIA semantics', async () => {
  await act(async () => root.render(<form><TomanInput id="amount" name="amount" defaultValue="123000" aria-describedby="hint" required /></form>));
  await edit('456000'); expect(input().value).toBe('۴۵۶٬۰۰۰');
  expect(new FormData(container.querySelector('form')!).get('amount')).toBe('۴۵۶٬۰۰۰');
  await act(async () => container.querySelector('form')!.reset()); expect(input().value).toBe('۱۲۳٬۰۰۰');
  expect(input().getAttribute('aria-describedby')).toBe('hint'); expect(input().required).toBe(true);
  await act(async () => root.render(<TomanInput value="123000" disabled aria-invalid="true" />));
  expect(input().disabled).toBe(true); expect(input().getAttribute('aria-invalid')).toBe('true');
});
it('pastes correctly grouped Persian/ASCII text but keeps ambiguous comma decimals invalid through further edits', async () => {
  const change = vi.fn(); await act(async () => root.render(<Controlled change={change} />));
  async function paste(text: string) {
    await act(async () => {
      input().focus(); input().select();
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
      input().dispatchEvent(event);
    });
  }
  await paste('۱۲۳٬۰۰۰'); expect(input().value).toBe('۱۲۳٬۰۰۰'); expect(change).toHaveBeenLastCalledWith('123000');
  await paste('1,5'); expect(input().value).toBe('1,5'); expect(change).toHaveBeenLastCalledWith('1,5');
  await edit('1,56'); expect(input().value).toBe('1,56'); expect(change).toHaveBeenLastCalledWith('1,56');
  await edit('156'); expect(input().value).toBe('۱۵۶'); expect(change).toHaveBeenLastCalledWith('156');
});
it('keeps the displayed caret/grouping intact during IME composition and formats only its committed value', async () => {
  const change = vi.fn(); await act(async () => root.render(<Controlled initial="123000" change={change} />));
  await act(async () => { input().focus(); input().setSelectionRange(4, 4); input().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); });
  expect(input().value).toBe('۱۲۳٬۰۰۰'); expect(input().selectionStart).toBe(4);
  await edit('۱۲۳٬۴۰۰۰', 5); expect(input().value).toBe('۱۲۳٬۴۰۰۰');
  await act(async () => input().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
  expect(input().value).toBe('۱٬۲۳۴٬۰۰۰'); expect(change).toHaveBeenLastCalledWith('1234000'); expect(input().selectionStart).toBe(5);
});
it('does not rescue an invalid comma draft by pasting digits into it or finishing composition', async () => {
  const change = vi.fn(); await act(async () => root.render(<Controlled change={change} />));
  async function paste(text: string) {
    await act(async () => {
      input().focus(); const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } }); input().dispatchEvent(event);
    });
  }
  await paste('1,5'); expect(input().value).toBe('1,5');
  await paste('2'); expect(input().value).toBe('1,52'); expect(change).toHaveBeenLastCalledWith('1,52');
  await act(async () => input().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
  await act(async () => input().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
  expect(input().value).toBe('1,52'); expect(change).toHaveBeenLastCalledWith('1,52');
});
it('does not replay an old uncontrolled caret after an unrelated parent render', async () => {
  await act(async () => root.render(<form><TomanInput defaultValue="123000" name="price" /></form>));
  await edit('456000'); input().setSelectionRange(2, 2);
  await act(async () => root.render(<form className="updated"><TomanInput defaultValue="123000" name="price" /></form>));
  expect(input().value).toBe('۴۵۶٬۰۰۰'); expect(input().selectionStart).toBe(2);
});
