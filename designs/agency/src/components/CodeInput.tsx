import { forwardRef, useState } from 'react';
import './code.css';

/**
 * Six-digit email code. One real input (works with paste and one-time-code autofill),
 * drawn as six boxes. Calls onComplete when the sixth digit lands.
 */
export const CodeInput = forwardRef<
  HTMLInputElement,
  {
    id: string;
    value: string;
    onChange: (v: string) => void;
    onComplete: (v: string) => void;
    invalid?: boolean;
    disabled?: boolean;
    describedBy?: string;
  }
>(function CodeInput({ id, value, onChange, onComplete, invalid, disabled, describedBy }, ref) {
  const [focused, setFocused] = useState(false);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const activeIndex = Math.min(value.length, 5);

  return (
    <div className={`code ${invalid ? 'is-invalid' : ''} ${disabled ? 'is-disabled' : ''}`} data-filled={value.length}>
      <input
        ref={ref}
        id={id}
        className="code__input"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          onChange(v);
          if (v.length === 6) onComplete(v);
        }}
      />
      <div className="code__boxes" aria-hidden="true">
        {digits.map((d, i) => (
          <span
            key={i}
            className={`code__box ${d.trim() ? 'is-filled' : ''} ${focused && i === activeIndex ? 'is-active' : ''}`}
          >
            {d.trim() ? <span className="code__digit">{d}</span> : focused && i === activeIndex ? <span className="code__caret" /> : null}
          </span>
        ))}
      </div>
    </div>
  );
});
