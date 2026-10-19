'use client';

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

/** Keeps the phone's native calendar and opens it from the whole field, not just its icon. */
export function DateInput({ onClick, className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input {...props} type="date" className={`date-picker min-h-11 min-w-0 max-w-full ${className}`} onClick={(event) => {
    onClick?.(event);
    if (!event.defaultPrevented && !event.currentTarget.readOnly) {
      try { event.currentTarget.showPicker?.(); } catch { /* Native controls still work when showPicker is unavailable. */ }
    }
  }} />;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const INPUT = 'min-h-11 min-w-0 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-base text-slate-100 focus:border-amber-400 focus:outline-none';
function parts(value = '') { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value.split(':') : ['', '']; }

/** Native select menus are scrollable on phones; no keyboard or free-text time entry is needed. */
export function TimeInput({ label, name, defaultValue = '', value, onChange, required, disabled, className = '' }: {
  label: string; name: string; defaultValue?: string; value?: string; onChange?: (value: string) => void;
  required?: boolean; disabled?: boolean; className?: string;
}) {
  const [selection, setSelection] = useState(() => parts(defaultValue));
  const [hour, minute] = value === undefined ? selection : parts(value);
  const hidden = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = hidden.current?.form;
    const reset = () => { if (value === undefined) setSelection(parts(defaultValue)); };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [defaultValue, value]);
  function choose(index: number, next: string) {
    const updated = [hour, minute];
    updated[index] = next;
    if (index === 0 && next && !updated[1]) updated[1] = '00';
    if (value === undefined) setSelection(updated);
    onChange?.(updated.every(Boolean) ? updated.join(':') : '');
  }
  return <fieldset disabled={disabled} className="min-w-0">
    <legend className="mb-1 text-sm text-slate-300">{label} <span className="text-xs text-slate-500">(24h)</span></legend>
    <input ref={hidden} type="hidden" name={name} value={hour && minute ? `${hour}:${minute}` : ''} />
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
      <select aria-label={`${label} hour`} value={hour} onChange={(event) => choose(0, event.target.value)} required={required} className={`${INPUT} ${className}`}>
        <option value="">Hour</option>{HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label={`${label} minute`} value={minute} onChange={(event) => choose(1, event.target.value)} required={required} className={`${INPUT} ${className}`}>
        <option value="">Min</option>{MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  </fieldset>;
}
