import { Children, Fragment, forwardRef, isValidElement, useCallback, useLayoutEffect, useRef, useState, type FormHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';
import { Dropdown, type MenuOption } from './SelectMenu';
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

/** `allowEmpty`: an optional question can go back to no answer, so its placeholder stays selectable. The rest place a
 *  compact variant: `wrapClass` for the field (instead of the 48px box), `btnClass` for its button, `display` for what
 *  the button shows, `minListWidth` for a narrow field's list. */
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
  wrapClass?: string;
  btnClass?: string;
  display?: (picked: MenuOption | undefined) => ReactNode;
  minListWidth?: number;
  /** See `Dropdown`: the box the list drops from, and no arrow when the field draws its own. */
  anchorTo?: string;
  noChevron?: boolean;
  /** Added to the hidden native select, for code (and tests) that find it by class. */
  nativeClass?: string;
};

/** The text inside an option ("BrightPath (India)" from `{name} ({region})`). */
const textOf = (n: ReactNode): string =>
  n === null || n === undefined || typeof n === 'boolean' ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(textOf).join('') : isValidElement(n) ? textOf((n.props as { children?: ReactNode }).children) : '';

/** The choices a select's `<option>`s and `<optgroup>`s describe, in order. */
function readOptions(children: ReactNode, group?: string): MenuOption[] {
  const out: MenuOption[] = [];
  Children.forEach(children, (ch) => {
    if (!isValidElement(ch)) return;
    const el = ch as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; label?: string }>;
    if (el.type === 'option') {
      const label = textOf(el.props.children);
      out.push({ value: String(el.props.value ?? label), label, disabled: !!el.props.disabled, group });
    } else if (el.type === 'optgroup') out.push(...readOptions(el.props.children, el.props.label));
    else if (el.type === Fragment) out.push(...readOptions(el.props.children, group));
    // a component here renders options the list can't read (9 Nov): map `<option>`s straight into the select instead
    else if (import.meta.env.DEV) console.warn('SelectInput: only <option>, <optgroup> and fragments are read as choices; this child is skipped.', el.type);
  });
  return out;
}

/**
 * A select (Nesil, 4 Nov): GSP's dropdown in every role, never the browser's own list. Written like a native select
 * (`<option>` children, `value`, `onChange(e)` with `e.target.value`), it shows the product's field and its white
 * list dropping from it (`Dropdown`). A hidden native select keeps the value, the id the label points to and the
 * change event, as Radix's Select does for forms; picking in the list sets it and fires `change`.
 */
export const SelectInput = forwardRef<HTMLSelectElement, SelectProps>(function SelectInput(
  { invalid, placeholder, allowEmpty = false, children, className = '', value, defaultValue, id, disabled, wrapClass, btnClass, display, minListWidth, anchorTo, noChevron, nativeClass = '', 'aria-label': ariaLabel, 'aria-labelledby': labelledBy, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const native = useRef<HTMLSelectElement | null>(null);
  const setRef = useCallback(
    (el: HTMLSelectElement | null) => {
      native.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  // the field's name: its aria-label, or the label that points to it (or wraps it)
  const [named, setNamed] = useState<string | undefined>(labelledBy);
  useLayoutEffect(() => {
    if (labelledBy || ariaLabel) return setNamed(labelledBy);
    const el = native.current;
    const label = (id ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`) : null) ?? el?.closest('label') ?? null;
    if (!label) return;
    if (!label.id) label.id = `${id ?? 'sel'}-label-${Math.random().toString(36).slice(2, 7)}`;
    setNamed(label.id);
  }, [id, labelledBy, ariaLabel]);

  const own = readOptions(children);
  // an empty choice that can't be picked is the field's placeholder, not a row in the list
  const blank = own.find((o) => o.value === '');
  const options: MenuOption[] = [...(placeholder && allowEmpty ? [{ value: '', label: placeholder }] : []), ...own.filter((o) => !(o.value === '' && o.disabled))];
  const current = String(value ?? defaultValue ?? '');
  // picking in the list sets the hidden select and fires its change event, so every onChange(e) works as before
  const fire = (v: string) => {
    const el = native.current;
    if (!el) return;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(el, v);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  return (
    <Dropdown
      id={id ? `${id}-field` : undefined}
      value={current}
      options={options}
      onPick={fire}
      placeholder={placeholder ?? blank?.label ?? 'Choose'}
      ariaLabel={ariaLabel}
      labelledBy={named}
      describedBy={describedBy}
      invalid={invalid}
      disabled={disabled}
      wrapClass={wrapClass ?? `control control--select smenu ${className}`}
      btnClass={btnClass}
      display={display}
      minListWidth={minListWidth}
      anchorTo={anchorTo}
      chevron={!noChevron}
      before={
        <select
          ref={setRef}
          id={id}
          className={`dd__native ${nativeClass}`}
          tabIndex={-1}
          aria-hidden="true"
          aria-invalid={invalid || undefined}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          {...rest}
          // a label's click lands here: the field's button takes it
          onFocus={(e) => (e.currentTarget.parentElement?.querySelector<HTMLButtonElement>('button[role="combobox"]')?.focus(), rest.onFocus?.(e))}
        >
          {placeholder && (
            <option value="" disabled={!allowEmpty}>
              {placeholder}
            </option>
          )}
          {children}
        </select>
      }
    />
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
