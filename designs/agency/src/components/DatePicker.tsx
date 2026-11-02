import { forwardRef, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { useAnchoredPopup } from './popup';
import { TextInput } from './forms';
import { dmyToIso, isoToDmy } from '../data/format';
import { typeDate } from '../data/dates';
import './datepicker.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  return new Date(x.getFullYear(), x.getMonth(), Math.min(d.getDate(), last));
};
const say = (d: Date) => `${DAY_NAMES[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/**
 * The portal's calendar (Jovial, 2 Nov: no system date picker). A month of days, Monday first, with the picked day
 * filled and today ringed; the title switches to a year grid and then the months, for dates years away (a date of
 * birth). Keyboard: arrows move a day or a week, Page Up and Down a month (with Shift, a year), Home and End the
 * week's ends, Enter or Space picks, Escape closes. Days before `min` or after `max` can't be picked.
 */
export function Calendar({ value, onPick, onClose, min, max, label = 'Choose a date' }: { value: string; onPick: (iso: string) => void; onClose: () => void; min?: string; max?: string; label?: string }) {
  const today = new Date();
  const picked = fromIso(value);
  const [focus, setFocus] = useState<Date>(() => picked ?? (fromIso(max) && fromIso(max)! < today ? fromIso(max)! : today));
  const [view, setView] = useState<'days' | 'years' | 'months'>('days');
  const grid = useRef<HTMLDivElement>(null);
  const lo = fromIso(min);
  const hi = fromIso(max);
  const off = (d: Date) => (lo && d < lo) || (hi && d > hi) || false;
  useEffect(() => {
    if (view === 'days') grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    else grid.current?.querySelector<HTMLElement>('[data-on="true"], button')?.focus();
  }, [focus, view]);

  const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i - lead));
  const weeks = Array.from({ length: cells[35].getMonth() === focus.getMonth() ? 6 : 5 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const key = (e: KeyboardEvent) => {
    const k = e.key;
    let to: Date | null = null;
    if (k === 'ArrowLeft') to = addDays(focus, -1);
    else if (k === 'ArrowRight') to = addDays(focus, 1);
    else if (k === 'ArrowUp') to = addDays(focus, -7);
    else if (k === 'ArrowDown') to = addDays(focus, 7);
    else if (k === 'PageUp') to = addMonths(focus, e.shiftKey ? -12 : -1);
    else if (k === 'PageDown') to = addMonths(focus, e.shiftKey ? 12 : 1);
    else if (k === 'Home') to = addDays(focus, -((focus.getDay() + 6) % 7));
    else if (k === 'End') to = addDays(focus, 6 - ((focus.getDay() + 6) % 7));
    else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (!off(focus)) onPick(toIso(focus));
      return;
    }
    if (!to) return;
    e.preventDefault();
    setFocus(to);
  };
  const esc = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation(); // closes the calendar, not the dialog it's in
    e.preventDefault();
    if (view !== 'days') setView('days');
    else onClose();
  };
  const decade = Math.floor(focus.getFullYear() / 12) * 12;
  return (
    <div className="dcal" role="dialog" aria-modal="false" aria-label={label} onKeyDown={esc}>
      <div className="dcal__head">
        <button
          type="button"
          className="dcal__title"
          aria-live="polite"
          onClick={() => setView(view === 'days' ? 'years' : 'days')}
          aria-label={view === 'days' ? `${MONTHS[focus.getMonth()]} ${focus.getFullYear()}: choose a year` : 'Back to the days'}
        >
          {view === 'years' ? `${decade} to ${decade + 11}` : view === 'months' ? focus.getFullYear() : `${MONTHS[focus.getMonth()]} ${focus.getFullYear()}`}
          <Icon name="chevronDown" size={16} className={view === 'days' ? '' : 'is-up'} />
        </button>
        <span className="dcal__nav">
          <button
            type="button"
            className="dcal__step"
            aria-label={view === 'years' ? 'Earlier years' : view === 'months' ? 'Previous year' : 'Previous month'}
            onClick={() => setFocus(view === 'years' ? addMonths(focus, -144) : addMonths(focus, view === 'months' ? -12 : -1))}
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <button
            type="button"
            className="dcal__step"
            aria-label={view === 'years' ? 'Later years' : view === 'months' ? 'Next year' : 'Next month'}
            onClick={() => setFocus(view === 'years' ? addMonths(focus, 144) : addMonths(focus, view === 'months' ? 12 : 1))}
          >
            <Icon name="chevronRight" size={18} />
          </button>
        </span>
      </div>
      {view === 'days' && (
        <div ref={grid} role="grid" aria-label={`${MONTHS[focus.getMonth()]} ${focus.getFullYear()}`} className="dcal__grid" onKeyDown={key}>
          <div role="row" className="dcal__row dcal__row--head">
            {DAYS.map((d, i) => (
              <span key={d} role="columnheader" aria-label={DAY_NAMES[i]} className="dcal__dow">
                {d}
              </span>
            ))}
          </div>
          {weeks.map((w, i) => (
            <div role="row" className="dcal__row" key={i}>
              {w.map((d) => {
                const iso = toIso(d);
                const out = d.getMonth() !== focus.getMonth();
                const on = !!picked && iso === toIso(picked);
                const now = iso === toIso(today);
                const dis = off(d);
                return (
                  <span role="gridcell" key={iso} aria-selected={on || undefined}>
                    <button
                      type="button"
                      tabIndex={iso === toIso(focus) ? 0 : -1}
                      className={`dcal__day ${out ? 'is-out' : ''} ${on ? 'is-on' : ''} ${now ? 'is-today' : ''}`}
                      aria-label={`${say(d)}${now ? ', today' : ''}`}
                      aria-pressed={on}
                      aria-current={now ? 'date' : undefined}
                      disabled={dis}
                      onClick={() => onPick(iso)}
                      onFocus={() => iso !== toIso(focus) && setFocus(d)}
                    >
                      {d.getDate()}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {view === 'years' && (
        <div ref={grid} className="dcal__pick" role="group" aria-label="Years">
          {Array.from({ length: 12 }, (_, i) => decade + i).map((y) => (
            <button key={y} type="button" className={`dcal__cell ${y === focus.getFullYear() ? 'is-on' : ''} ${y === today.getFullYear() ? 'is-today' : ''}`} data-on={y === focus.getFullYear()} aria-pressed={y === focus.getFullYear()}
              onClick={() => { setFocus(new Date(y, focus.getMonth(), Math.min(focus.getDate(), 28))); setView('months'); }}>
              {y}
            </button>
          ))}
        </div>
      )}
      {view === 'months' && (
        <div ref={grid} className="dcal__pick" role="group" aria-label={`Months of ${focus.getFullYear()}`}>
          {MONTHS.map((m, i) => (
            <button key={m} type="button" className={`dcal__cell ${i === focus.getMonth() ? 'is-on' : ''}`} data-on={i === focus.getMonth()} aria-pressed={i === focus.getMonth()}
              onClick={() => { setFocus(addMonths(new Date(focus.getFullYear(), i, 1), 0)); setView('days'); }}>
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      )}
      <div className="dcal__foot">
        <button type="button" className="dcal__link" disabled={off(today)} onClick={() => onPick(toIso(today))}>
          Today
        </button>
        <button type="button" className="dcal__link" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * The calendar button inside a date field: opens the portal's Calendar under the field. `value` and the day
 * picked are ISO days ("2026-11-05").
 */
export function CalendarButton({ value, onPick, min, max, disabled, label = 'Pick a date from a calendar' }: { value: string; onPick: (iso: string) => void; min?: string; max?: string; disabled?: boolean; label?: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLElement | null>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const close = (focus = true) => {
    setOpen(false);
    if (focus) btn.current?.focus();
  };
  field.current = btn.current?.closest<HTMLElement>('.control') ?? btn.current;
  const { into, style, at } = useAnchoredPopup(field, pop, open, { minWidth: 304, want: 380, onAway: () => close(false) });
  return (
    <span className="dpick">
      <button
        ref={btn}
        type="button"
        className="dpick__btn"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          field.current = btn.current?.closest<HTMLElement>('.control') ?? btn.current;
          setOpen((o) => !o);
        }}
      >
        <Icon name="calendar" size={18} />
      </button>
      {open &&
        style &&
        into &&
        createPortal(
          <div ref={pop} className={`dcal-pop ${at?.up ? 'is-up' : ''}`} style={{ ...style, width: 304, maxHeight: undefined }}>
            <Calendar
              value={value}
              min={min}
              max={max}
              onClose={() => close()}
              onPick={(iso) => {
                onPick(iso);
                close();
              }}
            />
          </div>,
          into,
        )}
    </span>
  );
}

type DateProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  /** The first and last days that can be picked from the calendar (ISO). */
  min?: string;
  max?: string;
};

/**
 * One date field (QC, 1 Nov; Jovial, 2 Nov): typed DD/MM/YYYY, the slashes put in as you type, or picked from the
 * portal's calendar. The value is an ISO day ("2026-11-05"), '' when empty, or the text typed while it isn't a real
 * day yet, so `dateError` can say so.
 */
export const DatePicker = forwardRef<HTMLInputElement, DateProps>(function DatePicker({ value, onChange, onBlur, placeholder = 'DD/MM/YYYY', min, max, ...rest }, ref) {
  const [text, setText] = useState(() => isoToDmy(value));
  // a value set from outside (a reset, a prefill) shows as typed
  useEffect(() => {
    if (value !== (dmyToIso(text) ?? text) && !(value === '' && text === '')) setText(isoToDmy(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <TextInput
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      maxLength={10}
      value={text}
      leading={
        <CalendarButton
          value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
          min={min}
          max={max}
          disabled={rest.disabled || rest.readOnly}
          onPick={(iso) => {
            setText(isoToDmy(iso));
            onChange(iso);
          }}
        />
      }
      onChange={(e) => {
        const t = typeDate(e.target.value);
        setText(t);
        onChange(!t ? '' : dmyToIso(t) ?? t);
      }}
      onBlur={onBlur}
      {...rest}
    />
  );
});
