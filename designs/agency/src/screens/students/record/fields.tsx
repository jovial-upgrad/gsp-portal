import { useState, type ReactNode } from 'react';
import { Field, SelectInput, TextInput, describedBy } from '../../../components/forms';
import { Icon } from '../../../components/Icon';
import type { Student } from '../../../data/students';

/** Changes the student; the record saves as you go. */
export type Update = (fn: (s: Student) => Student) => void;

/** A field read from a document stays tinted, with this note, until someone edits it. */
export const readNote = (from: string) => `From the ${from}. Check it.`;

/**
 * A text field for the record. Its error shows once the field has been left (not while typing),
 * and a field read from a document is tinted with a note.
 */
export function Txt({
  id,
  label,
  value,
  onChange,
  required,
  error,
  hint,
  read,
  placeholder,
  inputMode,
  type,
  disabled,
  format,
  after,
  tried,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  /** Shown after the field is left, or once Save was tried. */
  error?: string | null;
  /** Save was tried: the error shows even if the field was never left. */
  tried?: boolean;
  hint?: ReactNode;
  /** Where the value was read from, if it was. */
  read?: string | null;
  placeholder?: string;
  inputMode?: 'numeric' | 'decimal' | 'email' | 'tel' | 'text';
  type?: string;
  disabled?: boolean;
  /** Tidies the value as it's typed (dates). */
  format?: (v: string) => string;
  /** A line under the field, like a warning. */
  after?: ReactNode;
}) {
  const [left, setLeft] = useState(false);
  const err = (left || tried) && error ? error : null;
  const note = read ? readNote(read) : hint;
  return (
    <Field id={id} label={label} required={required} error={err} hint={after ? undefined : note}>
      <TextInput
        id={id}
        value={value}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        className={read ? 'is-auto' : ''}
        invalid={!!err}
        aria-describedby={describedBy(id, err, note || after)}
        onChange={(e) => onChange(format ? format(e.target.value) : e.target.value)}
        onBlur={() => setLeft(true)}
      />
      {!err && after}
    </Field>
  );
}

export function Sel({
  id,
  label,
  value,
  onChange,
  options,
  required,
  hint,
  read,
  placeholder = 'Choose',
  disabled,
  error,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: (string | [string, string])[];
  required?: boolean;
  hint?: ReactNode;
  read?: string | null;
  placeholder?: string;
  disabled?: boolean;
  /** Shown as given (Background shows it once Save was tried). */
  error?: string | null;
}) {
  const note = read ? readNote(read) : hint;
  return (
    <Field id={id} label={label} required={required} hint={note} error={error}>
      <SelectInput
        id={id}
        value={value}
        placeholder={placeholder}
        allowEmpty={!required}
        disabled={disabled}
        invalid={!!error}
        className={read ? 'is-auto' : ''}
        aria-describedby={describedBy(id, error, note)}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => {
          const [v, l] = typeof o === 'string' ? [o, o] : o;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </SelectInput>
    </Field>
  );
}

/** Pill-shaped radio buttons for a short choice. */
export function Choice<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
  required,
  hint,
  read,
  error,
}: {
  id: string;
  label: ReactNode;
  value: T | '';
  onChange: (v: T) => void;
  options: [T, string][];
  required?: boolean;
  hint?: ReactNode;
  read?: string | null;
  /** Shown as given, under the choices. */
  error?: string | null;
}) {
  const note = read ? readNote(read) : hint;
  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <p className="field__label" id={`${id}-l`}>
        {label}
        {required && (
          <>
            <span className="field__req" aria-hidden="true">
              *
            </span>
            <span className="vh"> (required)</span>
          </>
        )}
      </p>
      <div
        className={`radios ${read ? 'is-auto' : ''} ${error ? 'is-invalid' : ''}`}
        role="radiogroup"
        aria-labelledby={`${id}-l`}
        aria-describedby={describedBy(id, error, note)}
        aria-invalid={error ? true : undefined}
      >
        {options.map(([v, l]) => (
          <label key={v} className="radio">
            <input type="radio" name={id} value={v} checked={value === v} onChange={() => onChange(v)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
      {/* as in every field: the error, in place of the hint */}
      {error ? (
        <p className="field__msg field__msg--error" id={`${id}-error`} role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      ) : (
        note && (
          <p className={`field__msg ${read ? 'field__msg--auto' : ''}`} id={`${id}-hint`}>
            {note}
          </p>
        )
      )}
    </div>
  );
}
