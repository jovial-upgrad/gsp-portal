import { Children, Fragment, createContext, forwardRef, isValidElement, useContext, type FormHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';
import { SelectMenu, type MenuOption } from './SelectMenu';
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
type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'onBlur'> & {
  invalid?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
  value?: string | number | null;
  /** Called with the value picked, as `e.target.value`, the same as a select's change. */
  onChange?: (e: { target: { value: string; name?: string }; currentTarget: { value: string } }) => void;
  onBlur?: () => void;
  /** A search box over the list; on by itself for more than ten choices. */
  search?: boolean;
};

/** The text of an option's children ("Jo Bloggs · Kerala, India"). */
const textOf = (n: ReactNode): string =>
  n === null || n === undefined || typeof n === 'boolean' ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(textOf).join('') : isValidElement(n) ? textOf((n.props as { children?: ReactNode }).children) : '';

/** `<option>`s and `<optgroup>`s, read into the portal menu's choices. */
function readOptions(children: ReactNode, group?: string, out: MenuOption[] = []) {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const p = c.props as { value?: string | number; label?: string; disabled?: boolean; children?: ReactNode };
    if (c.type === 'option') {
      const label = textOf(p.children).replace(/\s+/g, ' ').trim();
      out.push({ value: p.value === undefined ? label : String(p.value), label, disabled: p.disabled, group });
    } else if (c.type === 'optgroup') readOptions(p.children, p.label, out);
    else if (c.type === Fragment) readOptions(p.children, group, out);
  });
  return out;
}

/**
 * The shared select (Jovial, 2 Nov: no system UI). Callers write `<option>`s as for a native select and get the
 * portal's SelectMenu: its list drops down from the field, styled by the design system in both themes, and a list
 * of more than ten has a search box.
 */
export const SelectInput = forwardRef<HTMLDivElement, SelectProps>(function SelectInput(
  { invalid: inv, placeholder, allowEmpty = false, children, className = '', value, onChange, onBlur, disabled, search, id, name, ...rest },
  _ref,
) {
  const { bad: invalid, desc } = useFieldAria(id, inv, rest['aria-describedby']);
  const listed = readOptions(children);
  const options: MenuOption[] = placeholder && allowEmpty && !listed.some((o) => o.value === '') ? [{ value: '', label: placeholder }, ...listed] : listed;
  const v = value === null || value === undefined ? '' : String(value);
  const label = rest['aria-label'] ?? (typeof placeholder === 'string' ? placeholder : 'Choices');
  return (
    <SelectMenu
      id={id}
      value={v}
      options={options}
      placeholder={placeholder ?? options.find((o) => o.value === '')?.label ?? 'Pick one'}
      label={label}
      ariaLabel={rest['aria-label']}
      labelledBy={rest['aria-labelledby']}
      invalid={invalid}
      describedBy={desc}
      disabled={disabled}
      search={search}
      onBlur={onBlur}
      className={`control--select ${className}`}
      onChange={(x) => onChange?.({ target: { value: x, name }, currentTarget: { value: x } })}
    />
  );
});

/**
 * One date field (QC, 1 Nov; Jovial, 2 Nov): typed DD/MM/YYYY, or picked from the portal's calendar. See DatePicker.
 */
export { DatePicker as DateInput } from './DatePicker';

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
