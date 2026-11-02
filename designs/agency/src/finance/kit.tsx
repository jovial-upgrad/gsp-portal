// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Finance and Work's kit (QC, 1 Nov, rule 1): thin wrappers over the portal's shared components (Button, Sheet,
 * Field, SelectInput, TextInput, DateInput, SearchInput, Toast), so these pages look and behave like every other:
 * the same tabs, close button, select arrow, search with its icon, errors under the field, Discard changes?, and the
 * notification in the bottom-left corner.
 */
import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Button as SharedButton } from '../components/Button';
import { Icon } from '../components/Icon';
import { Sheet as SharedSheet } from '../components/Sheet';
import { Field as SharedField, SelectInput, TextInput, DateInput, SearchInput } from '../components/forms';
import { NumberField } from '../components/NumberField';
import { notify } from '../components/Toast';
import { fmtDate as sharedDate } from '../data/format';

export function Page({ title, lead, actions, cfg, children, top }) {
  return (
    <div className={'ipage gspx-page' + (cfg ? ' cfg' : '')}>
      {top}
      <header className="stu__head">
        <div className="stu__titles">
          <h1 className="page__title">{title}</h1>
          {lead && <p className="stu__lead">{lead}</p>}
        </div>
        {actions && <div className="apps__acts">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

/* The shared Button (Jovial's rule 1, 1 Nov): kind primary, secondary, danger (red confirm) or danger-quiet (Delete). */
export function Button({ kind = 'secondary', size = 'md', children, ...rest }) {
  return (
    <SharedButton variant={kind} size={size} {...rest}>
      {children}
    </SharedButton>
  );
}

export const LinkButton = ({ children, ...rest }) => (
  <button type="button" className="btn btn--link gspx-link" {...rest}>{children}</button>
);

export function Card({ flush, children, className = '', ...rest }) {
  return <section className={`card ${flush ? 'cfg__panel is-flush' : 'gspx-card'} ${className}`} {...rest}>{children}</section>;
}

export function Tiles({ items, value, onChange }) {
  return (
    <div className="atiles itiles" role="group">
      {items.map(t => (
        <button key={t.id} type="button" className={`atile itile itile--${t.tone || 'gsp'}`}
          aria-pressed={String(value === t.id)} onClick={() => onChange && onChange(value === t.id ? null : t.id)}>
          <span className="atile__n num">{t.n}</span>
          <span className="atile__label">{t.label}</span>
          {t.sub && <span className="itile__sub">{t.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="iseg" role="group" aria-label={label}>
      {options.map(([v, t]) => (
        <button key={v} type="button" className="ichip" aria-pressed={String(value === v)} onClick={() => onChange(v)}>{t}</button>
      ))}
    </div>
  );
}

/** Tabs between a page's parts, the same as a record's (arrow keys move along them). */
let tabSeq = 0;
export function Tabs({ options, value, onChange, label }) {
  const reduce = useReducedMotion();
  const [id] = useState(() => `gtab${++tabSeq}`);
  const onKey = (e) => {
    const i = options.findIndex(([v]) => v === value);
    const n = e.key === 'ArrowRight' ? (i + 1) % options.length : e.key === 'ArrowLeft' ? (i + options.length - 1) % options.length : e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : -1;
    if (n < 0) return;
    e.preventDefault();
    onChange(options[n][0]);
    document.getElementById(`${id}-${n}`)?.focus();
  };
  return (
    <div className="atabs itabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {options.map(([v, t], i) => (
        <button key={v} id={`${id}-${i}`} type="button" role="tab" aria-selected={value === v} tabIndex={value === v ? 0 : -1} className="atabs__tab" onClick={() => onChange(v)}>
          {value === v && <motion.span layoutId={`${id}-lens`} className="atabs__lens" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }} />}
          <span className="atabs__in">{t}</span>
        </button>
      ))}
    </div>
  );
}

/** A labelled select (the shared one, with its arrow); `hideLabel` keeps the label for screen readers only. */
export function Select({ id, label, value, onChange, options, placeholder, hideLabel, required, error, hint, onBlur, disabled }) {
  const control = (
    <SelectInput id={id} aria-label={hideLabel ? label : undefined} value={value ?? ''} placeholder={placeholder ?? undefined} allowEmpty={placeholder != null} invalid={!!error} disabled={disabled} onBlur={onBlur} onChange={e => onChange(e.target.value)}>
      {options.map(o => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>)}
    </SelectInput>
  );
  if (!label || hideLabel) return <div className="gspx-select">{control}</div>;
  return (
    <SharedField id={id} label={label} required={required} error={error} hint={hint} className="gspx-select">
      {control}
    </SharedField>
  );
}

/** Label, control, then the hint or the error under it (aria-invalid and aria-describedby are wired by the shared Field). */
export function Field({ id, label, hint, required, error, children }) {
  return <SharedField id={id} label={label} required={required} error={error} hint={hint}>{children}</SharedField>;
}

const toNum = v => (v === '' ? '' : Number(v));
const numOut = t => (t === '' || t === '-' || t.endsWith('.') ? t : toNum(t));
/**
 * One input for Finance and Work: the shared text field, its error under it, a search box with its icon when the
 * placeholder starts "Search". Numbers use NumberInput, dates DateField (Jovial, 2 Nov: no system UI).
 */
export function Input({ id, value, onChange, type = 'text', error, ...rest }) {
  if (typeof rest.placeholder === 'string' && /^Search/.test(rest.placeholder)) {
    return <SearchInput id={id} label={rest['aria-label'] || rest.placeholder} placeholder={rest.placeholder} value={value ?? ''} onChange={onChange} />;
  }
  return <TextInput id={id} type={type} value={value ?? ''} invalid={!!error} {...rest} onChange={e => onChange(e.target.value)} />;
}

/**
 * A number (the shared NumberField): takes digits and a point and hands back a number, or '' when empty (empty is
 * not 0). `steppers` adds − / +; `min`, `max` and `step` bound them and the arrow keys.
 */
export function NumberInput({ id, value, onChange, error, decimal = true, ...rest }) {
  return <NumberField id={id} value={value} decimal={decimal} invalid={!!error} {...rest} onChange={t => onChange(numOut(t))} />;
}

/** The shared DD/MM/YYYY date field with the portal's calendar (an ISO day out). */
export function DateField({ id, value, onChange, error, ...rest }) {
  return <DateInput id={id} value={value ?? ''} onChange={onChange} invalid={!!error} {...rest} />;
}

/** A small number box inside a row or a sentence (bands, rates, SLAs): always named, red when it's wrong. */
export function Num({ label, value, onChange, error, unit, ...rest }) {
  return (
    <NumberField className="gspx-num" decimal aria-label={error ? `${label}: ${error}` : label} invalid={!!error} value={value} {...rest}
      onChange={t => onChange(t === '' ? '' : t.endsWith('.') || t === '-' ? t : Number(t))} />
  );
}

export const Pill = ({ tone = '', children }) => <span className={`dpill ${tone}`}>{children}</span>;
export const Chip = ({ children, onRemove }) => (
  <span className="cfg__chip cfg__chip--plain">{children}{onRemove && <button type="button" aria-label={`Remove ${children}`} onClick={onRemove}><Icon name="close" size={14} /></button>}</span>
);

export function Table({ head, children, empty, className = '' }) {
  return (
    <div className="stab-wrap">
      <table className={`itab ${className}`}>
        <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="sempty">
      <p className="gspx-empty-title">{title}</p>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

/**
 * A centred dialog: the shared Sheet (focus kept inside, Esc and the scrim close it, focus goes back). With `dirty`,
 * closing asks "Discard changes?" first. A footer's Delete goes first, on the left (kind="danger-quiet").
 */
export function Sheet({ title, sub, onClose, children, footer, wide, dirty = false, what }) {
  return (
    <SharedSheet open onClose={onClose} center title={title} sub={sub} dirty={dirty} what={what}
      className={'iform cfg__sheet' + (wide ? ' gspx-wide' : '')}
      footer={footer && <div className="asf"><div className="asf__acts">{footer}</div></div>}>
      {children}
    </SharedSheet>
  );
}

export function Notice({ tone = 'info', children }) {
  return <div className={`gspx-note gspx-note--${tone}`} role="status">{children}</div>;
}

/**
 * A confirmation in the shared notification, bottom left. Never a validation error: those go under their field.
 * `toast('Rejected.', { undo })` offers Undo.
 */
export function toast(text, o = {}) {
  notify({ title: text, ...o });
}

export const fmtDate = ms => sharedDate(ms, { list: true });
export const fmtAge = ms => {
  const d = Math.floor((Date.now() - ms) / 864e5);
  if (d <= 0) { const h = Math.max(1, Math.floor((Date.now() - ms) / 36e5)); return `${h} hour${h === 1 ? '' : 's'}`; }
  return `${d} day${d === 1 ? '' : 's'}`;
};
