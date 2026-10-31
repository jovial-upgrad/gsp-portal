import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { COUNTRIES } from '../data/partners';
import { dmyToIso } from '../data/format';

/*
 * One validation contract (QC, 1 Nov, rule 3): a field is checked when it's left and when the form is submitted;
 * the error sits under the field (aria-invalid, aria-describedby, read out); submitting focuses the first error;
 * nothing saves while an error shows, and no validation error ever goes in a notification. Messages name the field.
 */

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || '').trim());

/** "Enter the student's email." or "Enter a full email, like name@gmail.com." */
export function emailError(v: string, o: { what?: string; required?: boolean; example?: string } = {}) {
  const what = o.what ?? 'email';
  if (!(v || '').trim()) return o.required === false ? null : `Enter the ${what}.`;
  return isEmail(v) ? null : `Enter a full ${what}, like ${o.example ?? 'name@gmail.com'}.`;
}

/** How many digits a mobile number has, after the country code, in GSP's markets (and the destinations). */
export const PHONE_LEN: Record<string, [number, number]> = {
  '+91': [10, 10], // India
  '+977': [10, 10], // Nepal
  '+880': [10, 10], // Bangladesh
  '+94': [9, 9], // Sri Lanka
  '+234': [10, 10], // Nigeria
  '+84': [9, 10], // Vietnam
  '+92': [10, 10], // Pakistan
  '+63': [10, 10], // Philippines
  '+233': [9, 9], // Ghana
  '+254': [9, 9], // Kenya
  '+66': [9, 9], // Thailand
  '+62': [9, 12], // Indonesia
  '+60': [9, 10], // Malaysia
  '+61': [9, 9], // Australia
  '+64': [8, 10], // New Zealand
  '+44': [10, 10], // United Kingdom
  '+1': [10, 10], // United States, Canada
  '+353': [9, 9], // Ireland
  '+971': [9, 9], // UAE
  '+65': [8, 8], // Singapore
};
const countryOfDial = (dial: string) => (dial === '+1' ? 'the US and Canada' : COUNTRIES.find((c) => c.dial === dial)?.name ?? dial);

/** "Enter the phone number: 10 digits for India (+91)." Empty is fine unless `required`. */
export function phoneError(dial: string, number: string, o: { what?: string; required?: boolean } = {}) {
  const what = o.what ?? 'phone number';
  const n = (number || '').replace(/\D/g, '').length;
  if (!n) return o.required ? `Enter the ${what}.` : null;
  const [lo, hi] = PHONE_LEN[dial] ?? [7, 13];
  if (n >= lo && n <= hi) return null;
  const want = lo === hi ? `${lo} digits` : `${lo} to ${hi} digits`;
  return `Enter the ${what}: ${want} for ${countryOfDial(dial)} (${dial}), without the country code.`;
}

/**
 * Dates are typed DD/MM/YYYY (DateInput keeps an ISO day, or the text typed while it isn't a real day yet).
 * "Enter the start date as DD/MM/YYYY, like 05/11/2026."
 */
export function dateError(v: string, o: { what?: string; required?: boolean } = {}) {
  const what = o.what ?? 'date';
  if (!v) return o.required ? `Enter the ${what}.` : null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : `Enter the ${what} as DD/MM/YYYY, like 05/11/2026.`;
}
/** The end has to be after the start (both ISO days). */
export const afterError = (start: string, end: string, what = 'end date', from = 'start date') =>
  /^\d{4}-/.test(start || '') && /^\d{4}-/.test(end || '') && end < start ? `The ${what} has to be after the ${from}.` : null;
export { dmyToIso };

/**
 * A number in a range. Empty is not 0: it's "not set", fine unless `required`.
 * "Enter the rate as a number from 0 to 100."
 */
export function numError(v: unknown, o: { what: string; min?: number; max?: number; required?: boolean; int?: boolean; unit?: string }) {
  if (v === '' || v === null || v === undefined) return o.required ? `Enter the ${o.what}.` : null;
  const n = Number(v);
  const range = o.min !== undefined && o.max !== undefined ? ` from ${o.min} to ${o.max}${o.unit ?? ''}` : o.min !== undefined ? ` of ${o.min}${o.unit ?? ''} or more` : o.max !== undefined ? ` up to ${o.max}${o.unit ?? ''}` : '';
  if (Number.isNaN(n) || (o.int && !Number.isInteger(n))) return `Enter the ${o.what} as a ${o.int ? 'whole ' : ''}number${range}.`;
  if ((o.min !== undefined && n < o.min) || (o.max !== undefined && n > o.max)) return `Enter the ${o.what} as a number${range}.`;
  return null;
}
/** A percentage: 0 to 100. */
export const pctError = (v: unknown, what: string, required = false) => numError(v, { what, min: 0, max: 100, required, unit: '%' });

/** Already in the list (case and spaces ignored). "There's already a currency with the code AUD." */
export function dupError(v: string, others: string[], message: string) {
  const k = (v || '').trim().toLowerCase();
  return k && others.some((o) => (o || '').trim().toLowerCase() === k) ? message : null;
}

/** After a submit with errors: focus the first field marked invalid (inside `root`, or the open dialog, or the page). */
export function focusFirstError(root?: HTMLElement | null) {
  window.requestAnimationFrame(() =>
    window.setTimeout(() => {
      const scope = root ?? ([...document.querySelectorAll<HTMLElement>('.confirm-wrap, .sheet-wrap')].pop() || document.body);
      const el = scope.querySelector<HTMLElement>('[aria-invalid="true"]:not([disabled])');
      if (!el) return;
      el.focus({ preventScroll: false });
      el.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    }, 0),
  );
}

/**
 * The contract as a hook: give it the form's errors (null when fine), and it says which to show.
 * `err(k)` once the field's been left or the form submitted; `blur(k)` for onBlur; `submit()` shows them all, focuses
 * the first and says whether the form can go; `reset()` when the form opens again.
 */
export function useCheck<K extends string>(errors: Record<K, string | null | undefined | false>, root?: () => HTMLElement | null) {
  const [left, setLeft] = useState<Partial<Record<K, true>>>({});
  const [all, setAll] = useState(false);
  const errs = useRef(errors);
  errs.current = errors;
  const err = (k: K) => ((all || left[k]) && errors[k] ? (errors[k] as string) : null);
  const blur = useCallback((k: K) => () => setLeft((l) => (l[k] ? l : { ...l, [k]: true })), []);
  const submit = useCallback(() => {
    setAll(true);
    const bad = Object.values(errs.current).some(Boolean);
    if (bad) focusFirstError(root?.());
    return !bad;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = useCallback(() => {
    setLeft({});
    setAll(false);
  }, []);
  return { err, blur, submit, reset, any: Object.values(errors).some(Boolean), shown: all };
}

/**
 * Tells the fields under it to show their errors now, as if each had been left: a section's Save sets it, so a
 * field nobody touched still says what's wrong. A number that goes up each time Save is pressed.
 */
export const RevealErrors = createContext(0);
export const useRevealErrors = () => useContext(RevealErrors);
