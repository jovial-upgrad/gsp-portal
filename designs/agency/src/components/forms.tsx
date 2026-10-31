import { forwardRef, type FormHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';
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

/** Label → control → hint / error / success line. Ids wire the control to its messages for screen readers. */
export function Field({
  id,
  label,
  optional,
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
        {optional && <span className="field__optional"> (optional)</span>}
      </label>
      {children}
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

export const describedBy = (id: string, error?: string | null, hint?: unknown) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  valid?: boolean;
  trailing?: ReactNode;
  leading?: ReactNode;
};

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput(
  { invalid, valid, trailing, leading, className = '', ...rest },
  ref,
) {
  return (
    <div className={`control ${invalid ? 'is-invalid' : ''} ${valid ? 'is-valid' : ''} ${rest.disabled ? 'is-disabled' : ''} ${rest.readOnly ? 'is-readonly' : ''} ${className}`}>
      {leading && <span className="control__leading">{leading}</span>}
      <input ref={ref} className="control__input" aria-invalid={invalid || undefined} {...rest} />
      {trailing && <span className="control__trailing">{trailing}</span>}
    </div>
  );
});

/** `allowEmpty`: an optional question can go back to no answer, so its placeholder stays selectable. */
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; placeholder?: string; allowEmpty?: boolean };

export const SelectInput = forwardRef<HTMLSelectElement, SelectProps>(function SelectInput(
  { invalid, placeholder, allowEmpty = false, children, className = '', value, ...rest },
  ref,
) {
  return (
    <div className={`control control--select ${invalid ? 'is-invalid' : ''} ${rest.disabled ? 'is-disabled' : ''} ${!value ? 'is-empty' : ''} ${className}`}>
      <select ref={ref} className="control__input" aria-invalid={invalid || undefined} value={value} {...rest}>
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
