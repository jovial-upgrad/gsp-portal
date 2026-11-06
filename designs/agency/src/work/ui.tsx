/**
 * The work pages' controls, on the portal's own design-system components (Jovial, 2 Nov: no browser controls):
 * `Pick` is the shared SelectMenu in a Field, `TimePick` the shared TimePicker, `Tick` the shared Checkbox.
 */
import type { ReactNode } from 'react';
import { SelectMenu } from '../components/SelectMenu';
import { TimePicker } from '../components/TimePicker';
import { Field, Checkbox } from '../components/forms';

type Opt = string | [string, string];
const toMenu = (options: Opt[]) => options.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1] } : { value: o, label: o }));

/** A labelled dropdown (the shared SelectMenu); `hideLabel` keeps the name for screen readers only. */
export function Pick({ id, label, value, onChange, options, placeholder, hideLabel, required, error, hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string; hideLabel?: boolean; required?: boolean; error?: string | null; hint?: ReactNode;
}) {
  const menu = <SelectMenu id={id} label={label} value={value ?? ''} placeholder={placeholder ?? 'Choose'} options={toMenu(options)} onChange={onChange} invalid={!!error} describedBy={error ? `${id}-error` : hint ? `${id}-hint` : undefined} />;
  if (hideLabel) return <div className="gspx-select">{menu}</div>;
  return <Field id={id} label={label} required={required} error={error} hint={hint} className="gspx-select">{menu}</Field>;
}

/** Every half-hour of the day, "00:00" to "23:30". */
export const HALF_HOURS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
/** A time of day (IST unless `suffix` names another zone): the shared TimePicker, typed HH:MM or picked from the half-hours. */
export function TimePick({ id, label, value, onChange, error, hideLabel, suffix }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string | null; hideLabel?: boolean; suffix?: string }) {
  const t = <TimePicker id={id} value={value} onChange={onChange} step={30} {...(suffix !== undefined ? { suffix } : {})} invalid={!!error} ariaLabel={hideLabel ? label : undefined} describedBy={error ? `${id}-error` : undefined} />;
  if (hideLabel) return <div className="gspx-select">{t}</div>;
  return <Field id={id} label={label} error={error} className="gspx-select">{t}</Field>;
}

/** A tick box (the shared Checkbox). */
export const Tick = ({ id, checked, onChange, children, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode; hint?: ReactNode }) => (
  <Checkbox id={id} checked={checked} onChange={onChange} hint={hint}>{children}</Checkbox>
);
