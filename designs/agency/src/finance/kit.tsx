// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Thin wrappers that emit the designer's own class names, so add-on pages
 * look native. In his codebase, swap these for his real components
 * (Page header, Button, Table, Pill, Sheet, Field, Select, Tiles, Segmented).
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

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

export function Button({ kind = 'secondary', size = 'md', children, ...rest }) {
  return (
    <button type="button" className={`btn btn--${kind} btn--${size}`} {...rest}>
      <span className="btn__label">{children}</span>
    </button>
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

export function Select({ id, label, value, onChange, options, placeholder, hideLabel }) {
  return (
    <div className="gspx-select">
      {label && !hideLabel && <label className="field__label" htmlFor={id}>{label}</label>}
      <div className={'control control--select' + (value ? '' : ' is-empty')}>
        <select className="control__input" id={id} aria-label={hideLabel ? label : undefined} value={value ?? ''} onChange={e => onChange(e.target.value)}>
          {placeholder != null && <option value="">{placeholder}</option>}
          {options.map(o => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="control__chevron" aria-hidden="true">▾</span>
      </div>
    </div>
  );
}

export function Field({ id, label, hint, required, children }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}{required && <span className="field__req" aria-hidden="true">*</span>}</label>
      {children}
      {hint && <p className="field__msg">{hint}</p>}
    </div>
  );
}

export function Input({ id, value, onChange, type = 'text', ...rest }) {
  return (
    <div className="control">
      <input className="control__input" id={id} type={type} value={value ?? ''} onChange={e => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} {...rest} />
    </div>
  );
}

export const Pill = ({ tone = '', children }) => <span className={`dpill ${tone}`}>{children}</span>;
export const Chip = ({ children, onRemove }) => (
  <span className="cfg__chip cfg__chip--plain">{children}{onRemove && <button type="button" aria-label={`Remove ${children}`} onClick={onRemove}>×</button>}</span>
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

/* A centred dialog, in the designer's sheet markup, rendered into his #layer. */
export function Sheet({ title, sub, onClose, children, footer, wide }) {
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  const target = document.getElementById('layer') || document.body;
  return createPortal(
    <div className="sheet-wrap sheet-wrap--center gspx-sheetwrap">
      <div className="sheet__scrim" onClick={onClose} />
      <div className={'sheet sheet--center iform cfg__sheet' + (wide ? ' gspx-wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet__head">
          <div className="sheet__heading">
            <h2 className="sheet__title">{title}</h2>
            {sub && <p className="sheet__sub">{sub}</p>}
          </div>
          <button type="button" className="icon-btn sheet__close" aria-label="Close" onClick={onClose}>✕</button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer && <footer className="sheet__foot"><div className="asf"><div className="asf__acts">{footer}</div></div></footer>}
      </div>
    </div>,
    target,
  );
}

export function Notice({ tone = 'info', children }) {
  return <div className={`gspx-note gspx-note--${tone}`} role="status">{children}</div>;
}

let toastTimer;
export function toast(text) {
  let el = document.getElementById('gspx-toast');
  if (!el) { el = document.createElement('div'); el.id = 'gspx-toast'; el.className = 'gspx-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = text; el.classList.add('is-on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

export const fmtDate = ms => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const fmtAge = ms => {
  const d = Math.floor((Date.now() - ms) / 864e5);
  if (d <= 0) { const h = Math.max(1, Math.floor((Date.now() - ms) / 36e5)); return `${h} hour${h === 1 ? '' : 's'}`; }
  return `${d} day${d === 1 ? '' : 's'}`;
};
