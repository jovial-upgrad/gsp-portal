import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';
import { TextInput } from './forms';
import './numberfield.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max' | 'step'> & {
  value: string | number | null | undefined;
  /** The text as typed: digits, and a point or a minus sign where they're allowed. '' when empty (empty is not 0). */
  onChange: (text: string) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Takes a decimal point (rates, percentages); whole numbers only otherwise. */
  decimal?: boolean;
  /** The − and + buttons either side (they move a step, and stop at min and max). */
  steppers?: boolean;
  invalid?: boolean;
  /** A unit after the number ("days", "AUD"). */
  unit?: ReactNode;
  leading?: ReactNode;
};

const decimals = (n: number) => (String(n).split('.')[1] || '').length;

/**
 * A number field drawn by the portal (Jovial, 2 Nov: no system number box, no spinner arrows): a text box that takes
 * only what a number can hold, with optional − / + steppers. Arrow Up and Down move a step (Page Up and Down ten),
 * stopping at `min` and `max`; a value outside them is marked invalid, so the field's own error says why. It's an
 * ARIA spinbutton, so a screen reader hears the value and its range.
 */
export const NumberField = forwardRef<HTMLInputElement, Props>(function NumberField(
  { value, onChange, min, max, step = 1, decimal = false, steppers = false, invalid, unit, leading, className = '', disabled, readOnly, onKeyDown, ...rest },
  ref,
) {
  const text = value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value)) ? '' : String(value);
  const n = text === '' || text === '-' || text === '.' ? null : Number(text);
  const out = n !== null && Number.isFinite(n) && ((min !== undefined && n < min) || (max !== undefined && n > max));
  const neg = min !== undefined && min < 0;
  const clean = (t: string) => {
    let s = t.replace(decimal ? (neg ? /[^\d.-]/g : /[^\d.]/g) : neg ? /[^\d-]/g : /\D/g, '');
    if (neg) s = s.replace(/(?!^)-/g, '');
    if (decimal) {
      const i = s.indexOf('.');
      if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
    }
    return s;
  };
  const by = (k: number) => {
    // from empty, a step starts at the lowest allowed (or 0)
    let x = n !== null && Number.isFinite(n) ? n + k * step : min !== undefined ? Math.max(min, 0) : 0;
    if (min !== undefined) x = Math.max(min, x);
    if (max !== undefined) x = Math.min(max, x);
    const places = Math.max(decimals(step), decimals(min ?? 0));
    onChange(String(places ? Number(x.toFixed(places)) : Math.round(x)));
  };
  const locked = disabled || readOnly;
  const atMin = min !== undefined && n !== null && n <= min;
  const atMax = max !== undefined && n !== null && n >= max;
  return (
    <TextInput
      ref={ref}
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      role="spinbutton"
      aria-valuenow={n !== null && Number.isFinite(n) ? n : undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      className={`nfield ${steppers ? 'nfield--steppers' : ''} ${className}`}
      invalid={invalid || out}
      disabled={disabled}
      readOnly={readOnly}
      value={text}
      leading={
        steppers ? (
          <button type="button" className="nfield__step" aria-label="Decrease" tabIndex={-1} disabled={locked || atMin} onMouseDown={(e) => e.preventDefault()} onClick={() => by(-1)}>
            <Icon name="minus" size={16} />
          </button>
        ) : (
          leading
        )
      }
      trailing={
        steppers || unit ? (
          <>
            {unit && <span className="nfield__unit">{unit}</span>}
            {steppers && (
              <button type="button" className="nfield__step" aria-label="Increase" tabIndex={-1} disabled={locked || atMax} onMouseDown={(e) => e.preventDefault()} onClick={() => by(1)}>
                <Icon name="plus" size={16} />
              </button>
            )}
          </>
        ) : undefined
      }
      onChange={(e) => onChange(clean(e.target.value))}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || locked) return;
        const k = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : e.key === 'PageUp' ? 10 : e.key === 'PageDown' ? -10 : 0;
        if (!k) return;
        e.preventDefault();
        by(k);
      }}
      {...rest}
    />
  );
});
