import { Children, isValidElement, useEffect, useId, useImperativeHandle, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { GlassChevron, GlassOptionList, normalizeOption, type GlassOption } from './GlassOptionList';

type Props = Omit<ComponentPropsWithRef<'select'>, 'multiple' | 'size'>;
function textOf(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : String(child)).join('');
}
function optionsOf(children: ReactNode, groupDisabled = false): GlassOption[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; hidden?: boolean; label?: string }>(child)) return [];
    if (child.type === 'option') return child.props.hidden ? [] : [{ value: String(child.props.value ?? textOf(child.props.children)), label: child.props.label ?? textOf(child.props.children), disabled: groupDisabled || child.props.disabled }];
    return optionsOf(child.props.children, groupDisabled || child.props.disabled);
  });
}

/** Native form data and change events, with an accessible custom selection surface. */
export function GlassSelect({ id, value, defaultValue, children, onChange, disabled, required, className = '', ref, onInvalid, onKeyDown, ...props }: Props) {
  const generated = useId();
  const controlId = id ?? generated;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  useImperativeHandle(ref, () => native.current!);
  const options = optionsOf(children);
  const [uncontrolled, setUncontrolled] = useState(String(defaultValue ?? options.find(option => !option.disabled)?.value ?? ''));
  const selected = String(value ?? uncontrolled);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const typeahead = useRef({ text: '', time: 0 });
  const listId = `${controlId}-list`;
  const enabled = options.flatMap((option, index) => option.disabled ? [] : [index]);
  const expanded = open && !disabled;
  const chosen = options.find(option => option.value === selected);
  useEffect(() => { if (disabled) queueMicrotask(() => setOpen(false)); }, [disabled]);
  function begin(last = false) {
    if (disabled) return;
    const index = options.findIndex(option => option.value === selected && !option.disabled);
    setActive(index >= 0 ? index : (last ? enabled.at(-1) : enabled[0]) ?? 0); setOpen(true);
  }
  function select(option: GlassOption) {
    if (disabled || option.disabled || !native.current) return;
    setOpen(false); setInvalid(false);
    if (option.value !== selected) {
      if (value === undefined) setUncontrolled(option.value);
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(native.current, option.value);
      native.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
    trigger.current?.focus();
  }
  return <div ref={root} className="glass-select" data-disabled={disabled || undefined} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} id={controlId} type="button" className={`glass-select__trigger ${className}`} style={props.style} title={props.title} role="combobox" disabled={disabled} aria-haspopup="listbox"
      aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded && options[active] ? `${listId}-option-${active}` : undefined}
      aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid'] ?? (invalid || undefined)} aria-required={required || undefined}
      onClick={() => { if (expanded) setOpen(false); else begin(); }}
      onKeyDown={event => {
        if (event.key === 'Tab') { setOpen(false); return; }
        if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); if (!expanded) begin(); else if (options[active]) select(options[active]); return;
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          if (!expanded) {
            if (event.key === 'Home' || event.key === 'End') { setActive((event.key === 'Home' ? enabled[0] : enabled.at(-1)) ?? 0); setOpen(true); }
            else begin(event.key === 'ArrowUp');
            return;
          }
          const position = enabled.indexOf(active);
          const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1)
            : enabled[Math.max(0, Math.min(enabled.length - 1, position + (event.key === 'ArrowDown' ? 1 : -1)))];
          if (next !== undefined) setActive(next); return;
        }
        if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
          const now = Date.now();
          const text = normalizeOption((now - typeahead.current.time < 700 ? typeahead.current.text : '') + event.key);
          typeahead.current = { text, time: now };
          const index = options.findIndex(option => !option.disabled && normalizeOption(option.label).startsWith(text));
          if (index >= 0) { event.preventDefault(); setActive(index); setOpen(true); }
        }
      }}><span className="glass-select__value">{chosen?.label ?? 'انتخاب کنید'}</span><GlassChevron /></button>
    <select {...props} ref={native} id={`${controlId}-value`} hidden aria-hidden="true" aria-invalid={undefined} tabIndex={-1} value={selected} disabled={disabled} required={required}
      onKeyDown={onKeyDown} onInvalid={event => { onInvalid?.(event); event.preventDefault(); setInvalid(true); trigger.current?.focus(); }}
      onChange={event => { if (value === undefined) setUncontrolled(event.target.value); setInvalid(false); onChange?.(event); }}>{children}</select>
    {expanded && <GlassOptionList anchor={root} id={listId} label={props['aria-label'] ?? chosen?.label ?? 'گزینه‌ها'} options={options} value={selected} active={active} onActive={setActive} onSelect={select} onDismiss={() => setOpen(false)} />}
  </div>;
}
