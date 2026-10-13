import { useEffect, useId, useRef, useState } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

interface SearchableFilterProps {
  label: string;
  value: string;
  options: FilterOption[];
  onSelect: (value: string) => void;
  onInputChange?: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
}

const normalize = (value: string) =>
  value.trim().replaceAll('ي', 'ی').replaceAll('ك', 'ک').toLocaleLowerCase('fa');

/** Searchable single-choice filter. Free text is committed by the parent form when supported. */
export function SearchableFilter({
  label,
  value,
  options,
  onSelect,
  onInputChange,
  placeholder = 'انتخاب یا جستجو کنید',
  emptyLabel = 'موردی پیدا نشد',
}: SearchableFilterProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const chosen = options.find((option) => option.value === value)?.label ?? value;

  const normalizedQuery = normalize(query);
  const matches = options.filter((option) => normalize(option.label).includes(normalizedQuery));
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  function select(option: FilterOption) {
    setQuery(option.label);
    setOpen(false);
    onSelect(option.value);
    input.current?.focus();
  }

  return (
    <div
      className="searchable-filter"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery(chosen);
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="searchable-filter__control">
        <input
          ref={input}
          id={id}
          role="combobox"
          type="text"
          autoComplete="off"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? `${id}-list` : undefined}
          aria-activedescendant={open && matches[active] ? `${id}-option-${active}` : undefined}
          placeholder={placeholder}
          value={open ? query : chosen}
          onFocus={() => {
            setQuery('');
            setOpen(true);
            setActive(0);
          }}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
            onInputChange?.(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
              setQuery(chosen);
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((index) => open ? Math.max(0, Math.min(index + 1, matches.length - 1)) : 0);
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.max(index - 1, 0));
            }
            if (open && (event.key === 'Home' || event.key === 'End')) {
              event.preventDefault();
              setActive(event.key === 'Home' ? 0 : Math.max(0, matches.length - 1));
            }
            if (event.key === 'Enter' && open && matches[active]) {
              event.preventDefault();
              select(matches[active]);
            }
          }}
        />
        <button
          type="button"
          aria-label={`نمایش گزینه‌های ${label}`}
          aria-expanded={open}
          onClick={() => {
            setQuery('');
            setOpen(true);
            input.current?.focus();
          }}
        >
          <span aria-hidden="true">⌄</span>
        </button>
      </div>
      {open && (
        <div
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="searchable-filter__list"
        >
          {matches.length ? (
            matches.map((option, index) => (
              <div
                id={`${id}-option-${index}`}
                data-index={index}
                role="option"
                aria-selected={option.value === value}
                className={index === active ? 'is-active' : undefined}
                key={option.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(option)}
              >
                {option.label}
              </div>
            ))
          ) : (
            <p className="searchable-filter__empty">{emptyLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
