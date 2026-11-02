import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Icon } from '../../components/Icon';
import { Toast as SharedToast } from '../../components/Toast';
import type { Focus, Target } from '../portal/model';
import { dateText, type Stamp } from '../data/records';
import { SelectMenu, type MenuOption } from '../../components/SelectMenu';
import { dateTimeText, roleName, type Change, type Created } from '../data/changelog';

/** A records page's title, what it's for, and its main actions. */
export function PageHead({ title, lead, children }: { title: string; lead: string; children?: ReactNode }) {
  return (
    <header className="stu__head">
      <div className="stu__titles">
        <h1 className="page__title">{title}</h1>
        <p className="stu__lead">{lead}</p>
      </div>
      {children && <div className="apps__acts">{children}</div>}
    </header>
  );
}

/** Facts as label and value, two to a row on wide screens. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="ifacts">
      {items.map(([k, v]) => (
        <div key={k} className="ifacts__row">
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === '' ? <span className="muted">Not added</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A record's section, with its heading. */
export function Block({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="iblock">
      <div className="iblock__head">
        <h3 className="iblock__title">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** No results (slice 2 PRD): "Nothing matches these filters." with Clear filters. */
export function NoMatch({ onClear }: { what?: string; onClear: () => void }) {
  return (
    <div className="snone">
      <p className="snone__title">Nothing matches these filters.</p>
      <button type="button" className="btn btn--secondary btn--sm" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}

/** Empty (nothing yet): names what's missing, and offers the create action to those who can use it. */
export function Empty({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="snone">
      <p className="snone__title">
        {text}
        {action && onAction ? ' ' : ''}
        {action && onAction && (
          <button type="button" className="btn btn--link" onClick={onAction}>
            {action}
          </button>
        )}
      </p>
    </div>
  );
}

/** Not found (deleted or a wrong link), and permission denied, as every record page shows them. */
export function Gone({ denied = false, onBack, back }: { denied?: boolean; onBack: () => void; back: string }) {
  return (
    <div className="ipage">
      <button type="button" className="rback" onClick={onBack}>
        <Icon name="arrowLeft" size={18} />
        {back}
      </button>
      <section className="card irsec" role="alert">
        <p className="snone__title">{denied ? 'You don’t have access to this page.' : 'This record doesn’t exist or was removed.'}</p>
        {denied && (
          <button type="button" className="btn btn--link" onClick={onBack}>
            Go to Home
          </button>
        )}
      </section>
    </div>
  );
}

/** Rows a page (slice 2 PRD: 25 a page). */
export const PAGE = 25;

/** A list's page of rows, and its Previous / Next. The page goes back to the first when the rows change. */
export function usePager<T>(rows: T[], deps: unknown[] = []) {
  const [n, setN] = useState(0);
  const key = JSON.stringify(deps);
  useOnChange(key, () => setN(0));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const at = Math.min(n, pages - 1);
  const page = rows.slice(at * PAGE, at * PAGE + PAGE);
  const pager =
    rows.length > PAGE ? (
      <nav className="imore" aria-label="Pages">
        <button type="button" className="btn btn--secondary btn--sm" disabled={at === 0} onClick={() => setN(at - 1)}>
          Previous
        </button>
        <span className="imore__n">
          <span className="num">{(at * PAGE + 1).toLocaleString('en-GB')}</span>–<span className="num">{Math.min(rows.length, at * PAGE + PAGE).toLocaleString('en-GB')}</span> of <span className="num">{rows.length.toLocaleString('en-GB')}</span>
        </span>
        <button type="button" className="btn btn--secondary btn--sm" disabled={at >= pages - 1} onClick={() => setN(at + 1)}>
          Next
        </button>
      </nav>
    ) : null;
  return { page, pager };
}

/** A dropdown in the portal's own design (SelectMenu, never the browser's): `all` adds the empty "All …" choice for filters. */
export function Pick({ id, label, value, options, onChange, all, placeholder, invalid }: { id: string; label: string; value: string; options: readonly (string | MenuOption)[]; onChange: (v: string) => void; all?: string; placeholder?: string; invalid?: boolean }) {
  const opts: MenuOption[] = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return <SelectMenu id={id} label={label} value={value} placeholder={placeholder ?? all ?? 'Pick one'} invalid={invalid} options={all ? [{ value: '', label: all }, ...opts] : opts} onChange={onChange} />;
}

/** The Change log tab (S2-13, S2-14): every change, newest first, written by the system and read-only. */
export function ChangeLog({ log, id }: { log: Change[]; id: string }) {
  return (
    <Section title="Change log" id={id} note="Every change, newest first. The system writes it: nobody adds notes, and no entry can be edited or deleted.">
      {log.length ? (
        <div className="stab-wrap">
          <table className="itab">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Role</th>
                <th scope="col">What</th>
                <th scope="col">Old → new</th>
              </tr>
            </thead>
            <tbody>
              {log.map((e) => (
                <tr key={e.id}>
                  <td className="num">{dateTimeText(e.at)}</td>
                  <td>{e.who}</td>
                  <td>{roleName(e.role)}</td>
                  <td>{e.what}</td>
                  <td>
                    {e.from} → {e.to}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="iempty">No changes yet.</p>
      )}
    </Section>
  );
}

/** System information, at the foot of the Overview: created by and on; last modified by and on (the latest Change log entry). */
export function SystemInfo({ created, log }: { created: Created; log: Change[] }) {
  const last = log[0];
  return (
    <Section title="System information" id="sysinfo">
      <Facts
        items={[
          ['Created by', created.by],
          ['Created on', dateTimeText(created.at)],
          ['Last modified by', last ? last.who : created.by],
          ['Last modified on', dateTimeText(last ? last.at : created.at)],
        ]}
      />
    </Section>
  );
}

/** Runs when the value changes, not when the page first shows: the menu clearing an open record, but not one Home opened. */
export function useOnChange(value: unknown, fn: () => void) {
  const was = useRef(value);
  useEffect(() => {
    if (was.current === value) return;
    was.current = value;
    fn();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ---------- 29 Oct (2nd round): records as pages, after the PM prototype's IP team ---------- */

export type Tone = 'ok' | 'gsp' | 'you' | 'bad' | 'uni' | 'grey';
const PILL: Record<Tone, string> = { ok: 'dpill--verified', gsp: 'dpill--checking', you: 'dpill--missing', bad: 'dpill--bad', uni: 'dpill--uni', grey: 'idpill--grey' };
/** A status, in its colour and always in words. */
export const Pill = ({ tone, children }: { tone: Tone; children: ReactNode }) => <span className={`dpill ${PILL[tone]}`}>{children}</span>;

/** Tiles that count where things are, and filter the list to one of them. */
export function Tiles<K extends string>({ items, value, onPick, label }: { items: { key: K; n: number; label: string; sub?: string; tone: Tone }[]; value: K | ''; onPick: (k: K | '') => void; label: string }) {
  return (
    <div className="atiles itiles" role="group" aria-label={label}>
      {items.map((t) => (
        <button key={t.key} type="button" className={`atile itile itile--${t.tone}`} aria-pressed={value === t.key} onClick={() => onPick(value === t.key ? '' : t.key)}>
          <span className="atile__n num">{t.n.toLocaleString('en-GB')}</span>
          <span className="atile__label">{t.label}</span>
          {t.sub && <span className="itile__sub">{t.sub}</span>}
        </button>
      ))}
    </div>
  );
}

/** Who last changed this, and when (29 Oct, 7th round): small, grey, in italics, where it changed. */
export function Updated({ s }: { s?: Stamp }) {
  if (!s) return null;
  return (
    <p className="iupdated">
      Last updated by {s.by} on {dateText(s.at)}
    </p>
  );
}

/** A record's page: back to its list, then its header. `updated` is who last changed its status. */
export function RecordHead({ back, onBack, mark, title, sub, status, updated, children }: { back: string; onBack: () => void; mark?: ReactNode; title: string; sub: ReactNode; status?: ReactNode; updated?: Stamp; children?: ReactNode }) {
  return (
    <>
      <button type="button" className="rback" onClick={onBack}>
        <Icon name="arrowLeft" size={18} />
        {back}
      </button>
      <header className="card irhead">
        <div className="irhead__top">
          {mark ?? (
            <span className="irhead__mark" aria-hidden="true">
              {title.replace(/^University of (the )?/, '').slice(0, 1)}
            </span>
          )}
          <div className="irhead__names">
            <h1 className="irhead__title">{title}</h1>
            <p className="irhead__sub">{sub}</p>
          </div>
          {status && (
            <div className="irhead__status">
              {status}
              <Updated s={updated} />
            </div>
          )}
        </div>
        {children}
      </header>
    </>
  );
}

/** One row of tabs for a record (no tabs inside them). Arrow keys move along it. */
export function RecordTabs<K extends string>({ id, tabs, tab, setTab, label }: { id: string; tabs: { key: K; label: string; n?: number; badge?: number }[]; tab: K; setTab: (k: K) => void; label: string }) {
  const reduce = useReducedMotion();
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.key === tab);
    const n = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (n < 0) return;
    e.preventDefault();
    setTab(tabs[n].key);
    document.getElementById(`${id}-${tabs[n].key}`)?.focus();
  };
  return (
    <div className="atabs itabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button key={t.key} id={`${id}-${t.key}`} type="button" role="tab" aria-selected={tab === t.key} aria-controls={`${id}-panel`} tabIndex={tab === t.key ? 0 : -1} className="atabs__tab" onClick={() => setTab(t.key)}>
          {tab === t.key && <motion.span layoutId={`${id}-lens`} className="atabs__lens" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }} />}
          <span className="atabs__in">
            {t.label}
            {t.badge ? (
              <span className="atabs__badge atabs__badge--you num" title={`${t.badge} waiting`}>
                {t.badge}
              </span>
            ) : t.n !== undefined ? (
              <span className="atabs__n num">{t.n}</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}

/** A tab's panel. */
export const TabPanel = ({ id, tab, children }: { id: string; tab: string; children: ReactNode }) => (
  <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className="irpanel">
    {children}
  </div>
);

/** A section of a record's tab: a card with its heading, a line on what it's for, who last changed it, and its action. */
export function Section({ title, note, action, children, id, updated }: { title: string; note?: ReactNode; action?: ReactNode; children: ReactNode; id?: string; updated?: Stamp }) {
  return (
    <section className="card irsec" aria-labelledby={id}>
      <div className="irsec__head">
        <div className="irsec__t">
          <h2 className="irsec__title" id={id}>
            {title}
          </h2>
          {note && <p className="irsec__note">{note}</p>}
          <Updated s={updated} />
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A small "+ Add …" button for a section's head. */
export const AddButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" className="btn btn--secondary btn--sm iadd" onClick={onClick}>
    <Icon name="plus" size={16} /> {children}
  </button>
);

/** Downloads the rows as a CSV file, the first row its headings. */
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Toggles a value in a list. */
export const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

/** Field errors shown once Save is pressed. */
export function ErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p className="field__msg field__msg--error" id={id} role="alert">
      <Icon name="alert" size={16} />
      <span>{children}</span>
    </p>
  );
}

/**
 * Which record a list page has open: set when another page opens one (a new focus), cleared when the menu is used.
 * `back` goes to where it was opened from: another record, or the list.
 */
export function useRecord(focus: Focus | null, navKey: number, scrollTop: () => void, open: (t: Target) => void) {
  type Cur = Omit<Target, 'section'>;
  const [cur, setCur] = useState<Cur | null>(focus ? { id: focus.id, tab: focus.tab, back: focus.back } : null);
  const seen = useRef(focus?.key);
  useEffect(() => {
    if (!focus || focus.key === seen.current) return;
    seen.current = focus.key;
    setCur({ id: focus.id, tab: focus.tab, back: focus.back });
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useOnChange(navKey, () => setCur(null));
  return {
    cur,
    show: (id: string, tab?: string) => {
      setCur({ id, tab });
      scrollTop();
    },
    back: () => {
      if (cur?.back) open(cur.back);
      else {
        setCur(null);
        scrollTop();
      }
    },
  };
}

/** A confirmation, as every notification shows: the card in the bottom-left corner, for a few seconds, read out. */
export function Toast({ msg }: { msg: { text: string; key: number } | null }) {
  const [shown, setShown] = useState(msg);
  useEffect(() => setShown(msg), [msg?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <SharedToast t={shown && { key: shown.key, title: shown.text, icon: 'checkCircle', tone: 'ok' }} onClose={() => setShown(null)} />;
}
