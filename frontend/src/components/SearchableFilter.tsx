import { useEffect, useId, useRef, useState } from 'react';
import { GlassChevron, GlassOptionList, normalizeOption, type GlassOption } from './GlassOptionList';

export type FilterOption = GlassOption;
interface SearchableFilterProps {
  label: string; value: string; options: FilterOption[]; onSelect(value: string): void;
  onInputChange?(value: string): void; placeholder?: string; emptyLabel?: string;
  id?: string; disabled?: boolean; showLabel?: boolean; autoComplete?: string;
  'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false';
}

/** One searchable glass control. Free text remains supported by the parent. */
export function SearchableFilter({ label, value, options, onSelect, onInputChange, placeholder = 'انتخاب یا جستجو کنید', emptyLabel = 'موردی پیدا نشد', id, disabled, showLabel = true, autoComplete = 'off', 'aria-describedby': describedBy, 'aria-invalid': invalid }: SearchableFilterProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const input = useRef<HTMLInputElement>(null);
  const control = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const chosen = options.find(option => option.value === value)?.label ?? value;
  const matches = options.filter(option => normalizeOption(option.label).includes(normalizeOption(query)));
  const enabled = matches.flatMap((option, index) => option.disabled ? [] : [index]);
  const expanded = open && !disabled;
  const listId = `${controlId}-list`;
  useEffect(() => { if (disabled) queueMicrotask(() => setOpen(false)); }, [disabled]);
  function select(option: GlassOption) {
    if (disabled || option.disabled) return;
    setQuery(option.label); setOpen(false); onSelect(option.value); input.current?.focus();
  }
  function close() { setOpen(false); setQuery(chosen); }
  return <div className={`searchable-filter${showLabel ? '' : ' searchable-filter--unlabelled'}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }}>
    {showLabel && <label htmlFor={controlId}>{label}</label>}
    <div ref={control} className="searchable-filter__control" data-open={expanded} data-disabled={disabled || undefined}
      onClick={() => { if (!disabled) { input.current?.focus(); setOpen(true); } }}>
      <input ref={input} id={controlId} role="combobox" type="text" autoComplete={autoComplete} disabled={disabled}
        aria-label={!showLabel ? label : undefined} aria-describedby={describedBy} aria-invalid={invalid}
        aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && matches[active] ? `${listId}-option-${active}` : undefined}
        placeholder={placeholder} value={expanded ? query : chosen}
        onFocus={() => { setQuery(''); setOpen(true); setActive(0); }}
        onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); onInputChange?.(event.target.value); }}
        onKeyDown={event => {
          if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); close(); }
          else if (event.key === 'Tab') close();
          else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            const position = enabled.indexOf(active);
            const next = !expanded ? (event.key === 'ArrowUp' ? enabled.at(-1) : enabled[0]) : enabled[Math.max(0, Math.min(enabled.length - 1, position + (event.key === 'ArrowDown' ? 1 : -1)))];
            setActive(next ?? 0);
          } else if (expanded && (event.key === 'Home' || event.key === 'End')) {
            event.preventDefault(); setActive((event.key === 'Home' ? enabled[0] : enabled.at(-1)) ?? 0);
          } else if (event.key === 'Enter' && expanded && matches[active] && !matches[active]?.disabled) {
            event.preventDefault(); select(matches[active]);
          }
        }} />
      <GlassChevron />
    </div>
    {expanded && <GlassOptionList anchor={control} id={listId} label={label} options={matches} value={value} active={active} onActive={setActive} onSelect={select} onDismiss={close} emptyLabel={emptyLabel} />}
  </div>;
}
