import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { useAnchoredPopup } from './popup';
import './combobox.css';
import './datepicker.css';

const pad = (n: number) => String(n).padStart(2, '0');
const valid = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
/** "930" → "09:30" as it's typed; the colon goes in by itself. */
function typeTime(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, d.length - 2).padStart(2, '0')}:${d.slice(-2)}`;
}

/**
 * A time of day (Jovial, 2 Nov: no system time picker): typed HH:MM on the 24-hour clock, or picked from the
 * times in `step` minutes under the field. The value is "HH:MM", the same as the code keeps; a time half typed
 * isn't passed on, and leaving the field puts back the last good time. Arrow Down opens the list; arrows, Home and
 * End move through it; Enter picks; Escape closes it and leaves the dialog open.
 */
export function TimePicker({
  id,
  value,
  onChange,
  step = 30,
  invalid,
  describedBy,
  disabled,
  suffix = 'IST',
  ariaLabel,
  onBlur,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  step?: number;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  suffix?: string;
  ariaLabel?: string;
  onBlur?: () => void;
}) {
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pop = useRef<HTMLUListElement>(null);
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const times = useMemo(() => {
    const l = Array.from({ length: Math.ceil(1440 / step) }, (_, i) => `${pad(Math.floor((i * step) / 60))}:${pad((i * step) % 60)}`);
    return valid(value) && !l.includes(value) ? [...l, value].sort() : l;
  }, [step, value]);
  const [active, setActive] = useState(0);
  useEffect(() => setText(value), [value]);
  const { into, style, at } = useAnchoredPopup(wrap, pop, open, { want: 280, onAway: () => setOpen(false) });
  useEffect(() => {
    if (open) pop.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, at]);
  const show = () => {
    if (disabled) return;
    const i = times.indexOf(valid(text) ? text : value);
    setActive(i >= 0 ? i : times.indexOf('09:00'));
    setOpen(true);
  };
  const pick = (t: string) => {
    setText(t);
    if (t !== value) onChange(t);
    setOpen(false);
    input.current?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || (e.altKey && e.key === 'ArrowDown')) {
        e.preventDefault();
        show();
      }
      return;
    }
    const last = times.length - 1;
    if (e.key === 'ArrowDown') setActive((x) => Math.min(x + 1, last));
    else if (e.key === 'ArrowUp') setActive((x) => Math.max(x - 1, 0));
    else if (e.key === 'PageDown') setActive((x) => Math.min(x + 4, last));
    else if (e.key === 'PageUp') setActive((x) => Math.max(x - 4, 0));
    else if (e.key === 'Enter') pick(times[active]);
    else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Tab') return setOpen(false);
    else return;
    e.preventDefault();
  };
  return (
    <div ref={wrap} className={`control tpick ${invalid ? 'is-invalid' : ''} ${disabled ? 'is-disabled' : ''} ${open ? 'is-open' : ''}`}>
      <span className="control__leading">
        <button type="button" className="dpick__btn" aria-label="Pick a time" tabIndex={-1} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => (open ? setOpen(false) : (input.current?.focus(), show()))}>
          <Icon name="clock" size={18} />
        </button>
      </span>
      <input
        ref={input}
        id={id}
        className="control__input num"
        inputMode="numeric"
        autoComplete="off"
        placeholder="HH:MM"
        maxLength={5}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${listId}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          const t = typeTime(e.target.value);
          setText(t);
          if (valid(t)) {
            if (t !== value) onChange(t);
            const i = times.indexOf(t);
            if (i >= 0) setActive(i);
          }
        }}
        onClick={() => !open && show()}
        onKeyDown={onKey}
        onBlur={(e) => {
          if (pop.current?.contains(e.relatedTarget as Node)) return;
          if (!valid(text)) setText(value);
          setOpen(false);
          onBlur?.();
        }}
      />
      {suffix && <span className="tpick__suffix" aria-hidden="true">{suffix}</span>}
      {open &&
        style &&
        into &&
        createPortal(
          <ul ref={pop} id={`${listId}-list`} role="listbox" aria-label={ariaLabel ?? 'Times'} className={`cbx__list smenu__list tpick__list ${at?.up ? 'is-up' : ''}`} style={{ ...style, padding: 'var(--sp-6)', overflowY: 'auto', display: 'block' }}>
            {times.map((t, i) => (
              <li
                key={t}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={t === value}
                className={`cbx__opt ${i === active ? 'is-active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(t)}
              >
                <span className="cbx__name num">{t}</span>
                {suffix && <span className="cbx__dial">{suffix}</span>}
                {t === value && <Icon name="check" size={16} className="cbx__tick" />}
              </li>
            ))}
          </ul>,
          into,
        )}
    </div>
  );
}
