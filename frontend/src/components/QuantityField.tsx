import { useId, useLayoutEffect, useRef, type FocusEventHandler, type KeyboardEventHandler } from 'react';
import './quantity-field.css';

export const normalizeQuantityInput = (value: string) => value
  .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
  .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632));
export function parseQuantityInput(value: string, max: number): number | null {
  const raw = normalizeQuantityInput(value);
  const parsed = Number(raw);
  return /^\d+$/.test(raw) && Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}

export function QuantityField({ id, label = 'تعداد', value, onChange, max, disabled = false, onBlur, onKeyDown, invalid, describedBy, ariaLabel }: {
  id: string; label?: string | false; value: string; onChange: (value: string) => void; max: number; disabled?: boolean;
  onBlur?: FocusEventHandler<HTMLInputElement>; onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  invalid?: boolean; describedBy?: string; ariaLabel?: string;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef<{ start: number | null; end: number | null } | null>(null);
  const valid = parseQuantityInput(value, max) !== null;
  useLayoutEffect(() => {
    if (!selection.current) return;
    if (document.activeElement === input.current) input.current?.setSelectionRange(selection.current.start, selection.current.end);
    selection.current = null;
  }, [value]);
  return <div className="quantity-field">
    {label !== false && <label htmlFor={id}>{label}</label>}
    <input ref={input} id={id} type="text" inputMode="numeric" autoComplete="off" dir="ltr" list={listId}
      value={value} disabled={disabled} aria-label={ariaLabel} onBlur={onBlur} onKeyDown={onKeyDown}
      aria-invalid={invalid ?? !valid} aria-describedby={describedBy ?? (!valid ? `${id}-error` : undefined)}
      onChange={event => {
        const normalized = normalizeQuantityInput(event.target.value);
        selection.current = normalized !== value ? { start: event.target.selectionStart, end: event.target.selectionEnd } : null;
        onChange(normalized);
      }} />
    <datalist id={listId}>{Array.from({ length: Math.min(Math.max(0, max), 100) }, (_, index) =>
      <option key={index + 1} value={index + 1} label={(index + 1).toLocaleString('fa-IR')} />)}</datalist>
    {!valid && !describedBy && <p id={`${id}-error`} role="alert">تعداد باید عدد صحیح بین ۱ تا {max.toLocaleString('fa-IR')} باشد.</p>}
  </div>;
}
