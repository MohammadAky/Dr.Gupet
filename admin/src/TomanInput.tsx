import { useLayoutEffect, useRef, useState, type ComponentProps, type ChangeEvent } from 'react';
import { deleteTomanSeparator, formatTomanEdit, formatTomanInput, rawTomanInput } from './toman-input';

type Props = Omit<ComponentProps<'input'>, 'ref' | 'type' | 'inputMode' | 'dir' | 'onChange' | 'value' | 'defaultValue'> & {
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?(value: ReturnType<typeof rawTomanInput>): void;
};

/** Display grouping only: callbacks retain the original integer Toman digit string. */
export function TomanInput({ value, defaultValue, onValueChange, onKeyDown, onPaste, onCompositionStart, onCompositionEnd, ...props }: Props) {
  const control = useRef<HTMLInputElement>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);
  const [composing, setComposing] = useState(false);
  const [compositionDisplay, setCompositionDisplay] = useState('');
  const strictDraft = useRef(false);
  useLayoutEffect(() => {
    if (selection.current && control.current === document.activeElement) {
      control.current?.setSelectionRange(selection.current.start, selection.current.end);
    }
    selection.current = null;
  });
  function apply(edit: ReturnType<typeof formatTomanEdit>, input: HTMLInputElement) {
    selection.current = value !== undefined && String(value) !== edit.raw ? { start: edit.start, end: edit.end } : null;
    input.value = edit.display;
    input.setSelectionRange(edit.start, edit.end);
    onValueChange?.(edit.raw);
  }
  function commit(input: HTMLInputElement) {
    if (strictDraft.current) {
      const raw = rawTomanInput(input.value);
      if (!/^\d*$/u.test(raw)) {
        apply({ raw, display: input.value, start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 }, input);
        return;
      }
      strictDraft.current = false;
    }
    apply(formatTomanEdit(input.value, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length), input);
  }
  function change(event: ChangeEvent<HTMLInputElement>) {
    if (composing || (event.nativeEvent as InputEvent).isComposing) {
      setCompositionDisplay(event.target.value);
      onValueChange?.(event.target.value);
      return;
    }
    commit(event.target);
  }
  return <input {...props} ref={control} type="text" inputMode="numeric" dir="ltr"
    value={value === undefined ? undefined : composing ? compositionDisplay : formatTomanInput(value)}
    defaultValue={defaultValue === undefined ? undefined : formatTomanInput(defaultValue)}
    onChange={change}
    onPaste={event => {
      onPaste?.(event);
      if (event.defaultPrevented) return;
      const text = event.clipboardData.getData('text');
      if (!text) return;
      const input = event.currentTarget;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      event.preventDefault();
      const raw = rawTomanInput(text);
      const proposed = input.value.slice(0, start) + (/^\d*$/u.test(raw) ? raw : text) + input.value.slice(end);
      const combined = rawTomanInput(proposed);
      strictDraft.current = (strictDraft.current || !/^\d*$/u.test(raw)) && !/^\d*$/u.test(combined);
      if (!strictDraft.current) apply(formatTomanEdit(proposed, start + raw.length), input);
      else apply({ raw: combined, display: proposed, start: start + text.length, end: start + text.length }, input);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }}
    onCompositionStart={event => { setCompositionDisplay(event.currentTarget.value); setComposing(true); onCompositionStart?.(event); }}
    onCompositionEnd={event => {
      setComposing(false);
      commit(event.currentTarget);
      onCompositionEnd?.(event);
    }}
    onKeyDown={event => {
      onKeyDown?.(event);
      if (event.defaultPrevented || composing || strictDraft.current || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const input = event.currentTarget;
      if (input.selectionStart !== input.selectionEnd || (event.key !== 'Backspace' && event.key !== 'Delete')) return;
      const edit = deleteTomanSeparator(input.value, input.selectionStart ?? 0, event.key);
      if (!edit) return;
      event.preventDefault(); apply(edit, input);
      // Preserve the existing admin form's dirty tracking for an intercepted native edit.
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }} />;
}
