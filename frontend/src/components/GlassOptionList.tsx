import { useLayoutEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import '../styles/glass-select.css';

export interface GlassOption { value: string; label: string; disabled?: boolean }
export const normalizeOption = (value: string) => value.trim().replaceAll('ي', 'ی').replaceAll('ك', 'ک')
  .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
  .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632)).toLocaleLowerCase('fa');

export function GlassChevron() {
  return <svg className="glass-chevron" aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9.5 6 5 6-5" /></svg>;
}

/** A single stationary glass surface, positioned outside cards that may clip it. */
export function GlassOptionList({ anchor, id, label, options, active, value, onSelect, onActive, onDismiss, emptyLabel = 'موردی پیدا نشد' }: {
  anchor: RefObject<HTMLElement | null>; id: string; label: string; options: GlassOption[];
  active: number; value: string; onSelect(option: GlassOption): void; onActive(index: number): void;
  onDismiss(): void; emptyLabel?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  useLayoutEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useLayoutEffect(() => {
    const place = () => {
      const control = anchor.current, list = panel.current;
      if (!control || !list) return;
      const rect = control.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const below = viewportTop + height - rect.bottom - 12;
      const above = rect.top - viewportTop - 12;
      const upward = below < 180 && above > below;
      const menuWidth = Math.min(Math.max(160, rect.width), Math.max(0, width - 24));
      list.style.width = `${menuWidth}px`;
      list.style.left = `${Math.max(viewportLeft + 12, Math.min(rect.left, viewportLeft + width - menuWidth - 12))}px`;
      list.style.maxHeight = `${Math.max(80, Math.min(300, upward ? above : below))}px`;
      list.style.top = upward ? 'auto' : `${rect.bottom + 6}px`;
      list.style.bottom = upward ? `${window.innerHeight - rect.top + 6}px` : 'auto';
      list.dataset.side = upward ? 'above' : 'below';
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchor.current?.contains(event.target) && !panel.current?.contains(event.target)) dismiss.current();
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    document.addEventListener('pointerdown', outside, true);
    return () => {
      window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place);
      document.removeEventListener('pointerdown', outside, true);
    };
  }, [anchor]);
  useLayoutEffect(() => { panel.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' }); }, [active]);
  return createPortal(<div ref={panel} id={id} role="listbox" aria-label={label} className="glass-option-list" dir="rtl">
    {options.length ? options.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} data-index={index} data-value={option.value}
      role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined}
      className={index === active ? 'is-active' : undefined}
      onMouseDown={event => event.preventDefault()} onPointerMove={() => { if (!option.disabled) onActive(index); }}
      onClick={() => { if (!option.disabled) onSelect(option); }}>
      <span>{option.label}</span><span className="glass-option-list__check" aria-hidden="true">{option.value === value ? '✓' : ''}</span>
    </div>) : <p role="status" className="glass-option-list__empty">{emptyLabel}</p>}
  </div>, document.body);
}
