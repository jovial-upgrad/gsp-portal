import { createContext, forwardRef, useContext, useEffect, useRef, useState, type FormHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';
import { dmyToIso, isoToDmy } from '../data/format';
import { typeDate } from '../data/dates';
import './forms.css';

/**
 * A form that submits through script, not the browser. Clicking its submit button, or pressing Enter in a
 * field (the browser turns that into a click on the submit button), calls onSubmit directly. Native submission
 * is blocked in sandboxed frames without "allow-forms" (file previews, embeds), and this keeps forms working there.
 */
export function Form({ onSubmit, children, ...rest }: Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> & { onSubmit: () => void }) {
  return (
    <form
      noValidate
      {...rest}
      onClickCapture={(e) => {
        const button = (e.target as HTMLElement).closest('button');
        if (button && button.type === 'submit' && button.form === e.currentTarget) {
          e.preventDefault(); // stops the native submission, so onSubmit runs once
          onSubmit();
        }
      }}
      onSubmit={(e) => {
        e.preventDefault(); // a submission with no button click (requestSubmit), where the browser allows it
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

/** The field a control sits in: its id, and whether it shows an error or a hint, so the control can point at them. */
const FieldCtx = createContext<{ id: string; error: boolean; hint: boolean } | null>(null);

/**
 * Label → control → hint / error / success line. Ids wire the control to its messages for screen readers: a
 * TextInput, SelectInput or DateInput with the field's id is marked invalid and described by its message on its own.
 * Required fields have a red asterisk, explained once by "* Required" (RequiredNote; a Sheet adds it by itself).
 * `optional` is kept for old callers and shows nothing: nothing is ever labelled "(optional)" (QC, 1 Nov).
 */
export function Field({
  id,
  label,
  optional: _optional,
  required,
  hint,
  error,
  success,
  children,
  className = '',
}: {
  id: string;
  label: ReactNode;
  optional?: boolean;
  /** A red asterisk after the label; screen readers hear "required". */
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  success?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && (
          <>
            <span className="field__req" aria-hidden="true">
              *
            </span>
            <span className="vh"> (required)</span>
          </>
        )}
      </label>
      <FieldCtx.Provider value={{ id, error: !!error, hint: !error && !!(success || hint) }}>{children}</FieldCtx.Provider>
      {error ? (
        <p className="field__msg field__msg--error" id={`${id}-error`} role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      ) : success ? (
        <p className="field__msg field__msg--ok" id={`${id}-hint`}>
          <Icon name="checkCircle" size={16} />
          <span>{success}</span>
        </p>
      ) : hint ? (
        <p className="field__msg" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** "* Required", once per form, where its required fields are explained. */
export const RequiredNote = ({ className = '' }: { className?: string }) => (
  <p className={`req-note ${className}`}>
    <span className="field__req" aria-hidden="true">
      *
    </span>{' '}
    Required
  </p>
);

/** What the control in a Field gets by itself: aria-invalid and aria-describedby, unless it says otherwise. */
function useFieldAria(id: string | undefined, invalid: boolean | undefined, describedByProp: string | undefined) {
  const f = useContext(FieldCtx);
  const mine = !!f && !!id && f.id === id;
  const bad = invalid || (mine && f!.error);
  const desc = describedByProp ?? (mine ? (f!.error ? `${id}-error` : f!.hint ? `${id}-hint` : undefined) : undefined);
  return { bad, desc };
}

export const describedBy = (id: string, error?: string | null, hint?: unknown) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  valid?: boolean;
  trailing?: ReactNode;
  leading?: ReactNode;
};

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput(
  { invalid: inv, valid, trailing, leading, className = '', ...rest },
  ref,
) {
  const { bad: invalid, desc } = useFieldAria(rest.id, inv, rest['aria-describedby']);
  return (
    <div className={`control ${invalid ? 'is-invalid' : ''} ${valid ? 'is-valid' : ''} ${rest.disabled ? 'is-disabled' : ''} ${rest.readOnly ? 'is-readonly' : ''} ${className}`}>
      {leading && <span className="control__leading">{leading}</span>}
      <input ref={ref} className="control__input" aria-invalid={invalid || undefined} {...rest} aria-describedby={desc} />
      {trailing && <span className="control__trailing">{trailing}</span>}
    </div>
  );
});

/** `allowEmpty`: an optional question can go back to no answer, so its placeholder stays selectable. */
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; placeholder?: string; allowEmpty?: boolean };

export const SelectInput = forwardRef<HTMLSelectElement, SelectProps>(function SelectInput(
  { invalid: inv, placeholder, allowEmpty = false, children, className = '', value, ...rest },
  ref,
) {
  const { bad: invalid, desc } = useFieldAria(rest.id, inv, rest['aria-describedby']);
  return (
    <div className={`control control--select ${invalid ? 'is-invalid' : ''} ${rest.disabled ? 'is-disabled' : ''} ${!value ? 'is-empty' : ''} ${className}`}>
      <select ref={ref} className="control__input" aria-invalid={invalid || undefined} value={value} {...rest} aria-describedby={desc}>
        {placeholder && (
          <option value="" disabled={!allowEmpty}>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <span className="control__chevron" aria-hidden="true">
        <Icon name="chevronDown" size={18} />
      </span>
    </div>
  );
});

/**
 * One date field (QC, 1 Nov): typed DD/MM/YYYY, the slashes put in as you type. The value is an ISO day
 * ("2026-11-05"), '' when empty, or the text typed while it isn't a real day yet, so `dateError` can say so.
 */
export const DateInput = forwardRef<HTMLInputElement, Omit<InputProps, 'value' | 'onChange' | 'type'> & { value: string; onChange: (v: string) => void }>(function DateInput(
  { value, onChange, onBlur, placeholder = 'DD/MM/YYYY', ...rest },
  ref,
) {
  const [text, setText] = useState(() => isoToDmy(value));
  const pick = useRef<HTMLInputElement>(null);
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
      // the calendar opens a small date picker (Jovial, 1 Nov); typing DD/MM/YYYY still works
      leading={
        <span className="dpick">
          <button
            type="button"
            className="dpick__btn"
            aria-label="Pick a date from a calendar"
            onClick={() => {
              const el = pick.current as (HTMLInputElement & { showPicker?: () => void }) | null;
              try {
                el?.showPicker?.();
              } catch {
                el?.focus();
              }
            }}
          >
            <Icon name="calendar" size={18} />
          </button>
          <input
            ref={pick}
            type="date"
            className="dpick__native"
            tabIndex={-1}
            aria-hidden="true"
            value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
            onChange={(e) => {
              setText(isoToDmy(e.target.value));
              onChange(e.target.value);
            }}
          />
        </span>
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

/** A search box with its magnifier, as on every list (Students, Applications, Create roles). */
export function SearchInput({ id, label, value, onChange, placeholder, className = '' }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={`ssearch ${className}`}>
      <Icon name="search" size={18} />
      <span className="vh">{label}</span>
      <input id={id} type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/**
 * On/off switch for settings that apply straight away. While pressed, the knob stretches and turns
 * to glass (the HIG's one exception for glass in the content layer: a control being touched).
 */
export function Switch({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <div className="switch">
      <label htmlFor={id} className="switch__label">
        {children}
      </label>
      <button id={id} type="button" role="switch" aria-checked={checked} className="switch__track" onClick={() => onChange(!checked)}>
        <span className="switch__knob" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  children,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="check">
      <input id={id} type="checkbox" className="check__input" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id} className="check__label">
        <span className="check__box" aria-hidden="true">
          <Icon name="check" size={14} strokeWidth={2.4} />
        </span>
        <span>
          {children}
          {hint && <span className="check__hint">{hint}</span>}
        </span>
      </label>
    </div>
  );
}
