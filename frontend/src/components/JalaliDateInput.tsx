import { GlassSelect } from './GlassSelect';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { addDays, calendarLabel, digits, MONTHS, monthLength, shiftMonth, tehranFields, tehranInstant, todayTehran, toIsoDay, toPersianDay, WEEKDAYS } from './calendar';
import './jalali-calendar.css';

type Props = {
  id: string; name?: string; value: string; onChange(value: string): void;
  disabled?: boolean; max?: string; withTime?: boolean;
  'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false';
};
/** An inline disclosure avoids hidden/clipped popups in narrow account and admin forms. */
export function JalaliDateInput({ id, name, value, onChange, disabled, max, withTime = false, 'aria-describedby': describedBy, 'aria-invalid': invalid }: Props) {
  const trigger = useRef<HTMLButtonElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const dirtySignal = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const selected = value ? (withTime ? tehranFields(value).date : value.slice(0, 10)) : '';
  const initialDay = toPersianDay(selected || todayTehran());
  const maxPersianYear = max ? toPersianDay(max).year : null;
  const [view, setView] = useState(initialDay);
  const [focusDay, setFocusDay] = useState(selected || todayTehran());
  const time = value && withTime ? tehranFields(value) : { hour: 0, minute: 0 };
  const [message, setMessage] = useState('');
  const first = toIsoDay({ ...view, day: 1 });
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 1) % 7;
  const length = monthLength(view.year, view.month);
  useEffect(() => {
    if (open) region.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [open, focusDay]);
  function close() { setOpen(false); trigger.current?.focus(); }
  function change(next: string) {
    if (next !== value) {
      onChange(next);
      // Existing admin draft protection observes input events; keep date selections covered too.
      dirtySignal.current?.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setMessage('');
  }
  function choose(iso: string) {
    if (max && iso > max) return;
    try {
      if (iso !== selected) change(withTime ? tehranInstant(iso, time.hour, time.minute) : iso);
      setFocusDay(iso);
      if (!withTime) close();
    } catch { setMessage('این ساعت در منطقهٔ زمانی تهران معتبر نیست؛ ساعت دیگری انتخاب کنید.'); }
  }
  function move(iso: string) {
    const next = toPersianDay(iso);
    if (next.year < 1200 || next.year > 1600 || (max && iso > max)) return;
    setView(next); setFocusDay(iso);
  }
  function month(step: number) {
    const next = shiftMonth(view, step);
    if (next.year < 1200 || next.year > 1600 || (max && toIsoDay({ ...next, day: 1 }) > max)) return;
    setView(next);
    const candidate = toIsoDay(next);
    setFocusDay(max && candidate > max ? max : candidate);
  }
  function keys(event: KeyboardEvent<HTMLButtonElement>, iso: string) {
    const steps: Record<string, number> = { ArrowRight: -1, ArrowLeft: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in steps) { event.preventDefault(); move(addDays(iso, steps[event.key]!)); }
    else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); const position = (new Date(`${iso}T12:00:00Z`).getUTCDay() + 1) % 7;
      move(addDays(iso, event.key === 'Home' ? -position : 6 - position));
    } else if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); month(event.key === 'PageUp' ? -1 : 1); }
  }
  function setTime(part: 'hour' | 'minute', next: number) {
    try { change(tehranInstant(selected || todayTehran(), part === 'hour' ? next : time.hour, part === 'minute' ? next : time.minute)); }
    catch { setMessage('این ساعت در منطقهٔ زمانی تهران معتبر نیست؛ ساعت دیگری انتخاب کنید.'); }
  }
  return <div className="jalali-date" dir="rtl">
    <input type="hidden" ref={dirtySignal} value={value} readOnly />
    <button type="button" id={id} name={name} ref={trigger} className="jalali-date__trigger" disabled={disabled} aria-expanded={open} aria-controls={`${id}-calendar`} aria-describedby={describedBy} aria-invalid={invalid} onClick={() => {
      if (open) close(); else { const date = selected || todayTehran(); setView(toPersianDay(date)); setFocusDay(date); setOpen(true); }
    }}>
      <span>{calendarLabel(value, withTime)}</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></svg>
    </button>
    {open && <div id={`${id}-calendar`} ref={region} className="jalali-date__calendar" role="region" aria-label="تقویم" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
      <div className="jalali-date__navigation">
        <button type="button" aria-label="ماه قبل" disabled={disabled || (view.year === 1200 && view.month === 1)} onClick={() => month(-1)}>‹</button>
        <GlassSelect aria-label="ماه" disabled={disabled} value={view.month} data-draft-selector onChange={event => {
          const next = { ...view, month: Number(event.target.value), day: 1 }; setView(next); setFocusDay(toIsoDay(next));
        }}>{MONTHS.map((name, index) => <option key={name} value={index + 1} disabled={!!(max && toIsoDay({ year: view.year, month: index + 1, day: 1 }) > max)}>{name}</option>)}</GlassSelect>
        <GlassSelect aria-label="سال" data-draft-selector value={view.year} disabled={disabled} onChange={event => {
          let next = { ...view, year: Number(event.target.value), day: 1 };
          if (max && toIsoDay(next) > max) next = { ...toPersianDay(max), day: 1 };
          setView(next); setFocusDay(toIsoDay(next));
        }}>{Array.from({ length: 401 }, (_, index) => 1200 + index).map(year => <option key={year} value={year} disabled={maxPersianYear !== null && year > maxPersianYear}>{digits(year)}</option>)}</GlassSelect>
        <button type="button" aria-label="ماه بعد" disabled={disabled || (view.year === 1600 && view.month === 12) || !!(max && view.year < 1600 && toIsoDay({ ...shiftMonth(view, 1), day: 1 }) > max)} onClick={() => month(1)}>›</button>
      </div>
      <p className="jalali-date__month" aria-live="polite">{MONTHS[view.month - 1]} {digits(view.year)}</p>
      <div className="jalali-date__grid" role="group" aria-label="روزهای ماه">
        {WEEKDAYS.map((day, index) => <span key={index} className="jalali-date__weekday" aria-hidden="true">{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length }, (_, index) => {
          const day = index + 1; const iso = toIsoDay({ ...view, day });
          return <button key={iso} data-day={iso} type="button" aria-label={calendarLabel(iso)} aria-pressed={selected === iso} aria-current={iso === todayTehran() ? 'date' : undefined} tabIndex={iso === focusDay ? 0 : -1} disabled={disabled || !!(max && iso > max)} onFocus={() => setFocusDay(iso)} onKeyDown={event => keys(event, iso)} onClick={() => choose(iso)}>{digits(day)}</button>;
        })}
      </div>
      {withTime && <div className="jalali-date__time">
        <label htmlFor={`${id}-hour`}>ساعت تهران<GlassSelect id={`${id}-hour`} aria-label="ساعت تهران" disabled={disabled} value={time.hour} onChange={event => setTime('hour', Number(event.target.value))}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{digits(hour).padStart(2, '۰')}</option>)}</GlassSelect></label>
        <label htmlFor={`${id}-minute`}>دقیقه<GlassSelect id={`${id}-minute`} aria-label="دقیقه" disabled={disabled} value={time.minute} onChange={event => setTime('minute', Number(event.target.value))}>{Array.from({ length: 60 }, (_, minute) => <option key={minute} value={minute}>{digits(minute).padStart(2, '۰')}</option>)}</GlassSelect></label>
      </div>}
      {message && <p role="alert">{message}</p>}
      <div className="jalali-date__actions"><button type="button" disabled={disabled || !value} onClick={() => { change(''); close(); }}>پاک کردن تاریخ</button><button type="button" data-draft-keep onClick={close}>بستن تقویم</button></div>
    </div>}
  </div>;
}
