import { useState, type ReactNode } from 'react';
import { PhoneInput } from '../../../components/PhoneInput';
import { useRevealErrors } from '../../../components/validate';
import { Field, SelectInput, TextInput, describedBy } from '../../../components/forms';
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
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  /** Shown after the field is left. */
  error?: string | null;
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
  // shown once the field's been left, or when Save is pressed (QC, 1 Nov)
  const reveal = useRevealErrors();
  const err = (left || reveal > 0) && error ? error : null;
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
}) {
  const note = read ? readNote(read) : hint;
  return (
    <Field id={id} label={label} required={required} hint={note}>
      <SelectInput id={id} value={value} placeholder={placeholder} allowEmpty={!required} disabled={disabled} className={read ? 'is-auto' : ''} aria-describedby={note ? `${id}-hint` : undefined} onChange={(e) => onChange(e.target.value)}>
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
}: {
  id: string;
  label: ReactNode;
  value: T | '';
  onChange: (v: T) => void;
  options: [T, string][];
  required?: boolean;
  hint?: ReactNode;
  read?: string | null;
}) {
  const note = read ? readNote(read) : hint;
  return (
    <div className="field">
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
      <div className={`radios ${read ? 'is-auto' : ''}`} role="radiogroup" aria-labelledby={`${id}-l`} aria-describedby={note ? `${id}-hint` : undefined}>
        {options.map(([v, l]) => (
          <label key={v} className="radio">
            <input type="radio" name={id} value={v} checked={value === v} onChange={() => onChange(v)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
      {note && (
        <p className={`field__msg ${read ? 'field__msg--auto' : ''}`} id={`${id}-hint`}>
          {note}
        </p>
      )}
    </div>
  );
}

/** The phone number, with its country code; its error (the length its country needs) shows once it's left or on Save. */
export function Phone({ id, dial, number, onDial, onNumber, error, required }: { id: string; dial: string; number: string; onDial: (v: string) => void; onNumber: (v: string) => void; error?: string | null; required?: boolean }) {
  const [left, setLeft] = useState(false);
  const reveal = useRevealErrors();
  const err = (left || reveal > 0) && error ? error : null;
  return (
    <Field id={id} label="Phone number" required={required} error={err}>
      <PhoneInput id={id} dial={dial} number={number} invalid={!!err} describedBy={err ? `${id}-error` : undefined} onBlur={() => setLeft(true)} onDial={onDial} onNumber={onNumber} />
    </Field>
  );
}
