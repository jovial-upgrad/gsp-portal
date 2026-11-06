import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { EditOnly } from '../../proto/viewOnly';
import { motion, useReducedMotion } from 'motion/react';
import { Icon, type IconName } from '../../components/Icon';
import { Toast as SharedToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MultiPick } from '../../components/MultiPick';
import type { Focus, Target } from '../portal/model';
import { dateText, dateTimeText, type LogLine, type Stamp } from '../data/records';

/** A records page's title, what it's for, and its main actions: on the right at every width (3 Nov), under the title when there's no room beside it. */
export function PageHead({ title, lead, children }: { title: string; lead: string; children?: ReactNode }) {
  return (
    <header className="stu__head ihead">
      <div className="stu__titles">
        <h1 className="page__title">{title}</h1>
        <p className="stu__lead">{lead}</p>
      </div>
      {children && <div className="apps__acts ihead__acts">{children}</div>}
    </header>
  );
}

/** Facts as label and value, several to a row on wide screens; a `wide` one takes the whole row. */
export function Facts({ items }: { items: ([string, ReactNode] | [string, ReactNode, 'wide'])[] }) {
  return (
    <dl className="ifacts">
      {items.map(([k, v, w]) => (
        <div key={k} className={`ifacts__row ${w ? 'ifacts__row--wide' : ''}`}>
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

/** Nothing matches: what to do about it. */
export function NoMatch({ what, onClear }: { what: string; onClear: () => void }) {
  return (
    <div className="snone">
      <p className="snone__title">No {what} match</p>
      <p className="snone__text">Try another name, or clear the filters.</p>
      <button type="button" className="btn btn--secondary btn--sm" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}

/** Lines shown at a time on a long timeline (Logs); Show older adds the next lot. */
export const PAGE = 40;

/** Rows a page (Nesil, 4 Nov): every table in this role shows 20 rows, then its pages. */
export const PER_PAGE = 20;
export type Paged<T> = { rows: T[]; page: number; pages: number; setPage: (n: number) => void; from: number; to: number; total: number };
/** The rows on the page shown; back to the first page when `reset` changes (a search, a filter, a tile). */
export function usePaged<T>(all: T[], reset: unknown[] = [], per = PER_PAGE): Paged<T> {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), reset); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(all.length / per));
  const p = Math.min(page, pages);
  return { rows: all.slice((p - 1) * per, p * per), page: p, pages, setPage, from: all.length ? (p - 1) * per + 1 : 0, to: Math.min(p * per, all.length), total: all.length };
}

/**
 * Under a table (Nesil, 4 Nov): which rows show ("Showing 1–20 of 29 partners"), and the pages with Previous and
 * Next, once there's more than one. A new page starts at the table's top.
 */
export function Pager<T>({ pg, what }: { pg: Paged<T>; what: string }) {
  const box = useRef<HTMLElement>(null);
  if (pg.pages <= 1) return null;
  // the first, the last, and the one either side of the page shown
  const nums = Array.from({ length: pg.pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pg.pages || Math.abs(n - pg.page) <= 1);
  const go = (n: number) => {
    pg.setPage(n);
    const top = box.current?.closest('.card, .irsec') as HTMLElement | null;
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start' });
  };
  return (
    <nav ref={box} className="ipager" aria-label={`Pages of ${what}`}>
      <p className="ipager__n" role="status">
        Showing <span className="num">{pg.from.toLocaleString('en-GB')}</span>–<span className="num">{pg.to.toLocaleString('en-GB')}</span> of <span className="num">{pg.total.toLocaleString('en-GB')}</span> {what}
      </p>
      <div className="ipager__btns">
        <button type="button" className="ipg" disabled={pg.page === 1} onClick={() => go(pg.page - 1)} aria-label="Previous page">
          <Icon name="arrowLeft" size={16} />
        </button>
        {nums.map((n, i) => (
          <span key={n} className="ipg__wrap">
            {i > 0 && n - nums[i - 1] > 1 && (
              <span className="ipg__gap" aria-hidden="true">
                …
              </span>
            )}
            <button type="button" className="ipg num" aria-current={n === pg.page ? 'page' : undefined} aria-label={`Page ${n}`} onClick={() => go(n)}>
              {n}
            </button>
          </span>
        ))}
        <button type="button" className="ipg" disabled={pg.page === pg.pages} onClick={() => go(pg.page + 1)} aria-label="Next page">
          <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </nav>
  );
}

/**
 * A filter above a list (Nesil, 4 Nov): every one picks several, starting on "All …". `labels` shows a value
 * another way in the list ("Raj Shamani (you)").
 */
export function Filter({ id, label, all, value, options, onChange, labels, search }: { id: string; label: string; all: string; value: string[]; options: readonly string[]; onChange: (v: string[]) => void; labels?: (v: string) => string; search?: boolean }) {
  const show = labels ?? ((v: string) => v);
  const back = new Map(options.map((o) => [show(o), o]));
  return (
    <div className="ifilter">
      <MultiPick id={id} label={label} value={value.map(show)} options={options.map(show)} onChange={(l) => onChange(l.map((x) => back.get(x) ?? x))} empty={all} all={all} search={search ?? options.length > 10} />
    </div>
  );
}
/** No filter picked means every value passes. */
export const passes = (picked: string[], v: string) => !picked.length || picked.includes(v);

/**
 * Asks before a remove or a delete (Nesil, 4 Nov: every one in this role asks first). `ask` opens the question;
 * `dialog` goes once in the page.
 */
export function useAsk() {
  type Q = { title: string; confirm: string; text: ReactNode; run: () => void };
  const [q, setQ] = useState<Q | null>(null);
  const [open, setOpen] = useState(false);
  return {
    ask: (title: string, confirm: string, text: ReactNode, run: () => void) => {
      setQ({ title, confirm, text, run });
      setOpen(true);
    },
    dialog: (
      <ConfirmDialog
        open={open}
        title={q?.title ?? ''}
        confirm={q?.confirm ?? 'Remove'}
        onConfirm={() => {
          setOpen(false);
          q?.run();
        }}
        onCancel={() => setOpen(false)}
      >
        {q?.text ?? null}
      </ConfirmDialog>
    ),
  };
}

/** A section that opens and closes (4 Nov): its title in a bar with an arrow, closed to start. */
export function Fold({ title, id, children, count }: { title: string; id: string; children: ReactNode; count?: number }) {
  return (
    <details className="card ifold" id={id}>
      <summary className="ifold__head">
        <span className="ifold__title">
          {title}
          {count !== undefined && <span className="ifold__n num">{count}</span>}
        </span>
        <Icon name="chevronDown" size={18} />
      </summary>
      <div className="ifold__body">{children}</div>
    </details>
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
  <EditOnly>
    <button type="button" className="btn btn--secondary btn--sm iadd" onClick={onClick}>
      <Icon name="plus" size={16} /> {children}
    </button>
  </EditOnly>
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

/** System information (3 Nov): who added the record and when, and who changed it last and when. */
export function SystemInfo({ id, created, last }: { id: string; created: Stamp; last: Stamp }) {
  return (
    <Section title="System information" id={id}>
      <Facts
        items={[
          ['Created by', created.by],
          ['Created on', <span key="c" className="num">{dateTimeText(created.at)}</span>],
          ['Last modified by', last.by],
          ['Last modified on', <span key="m" className="num">{dateTimeText(last.at)}</span>],
        ]}
      />
    </Section>
  );
}

/** The icon for each part of a record, on its line in Logs. */
const PART_ICON: Record<string, IconName> = { status: 'checkCircle', partner: 'partner', profile: 'building', campuses: 'pin', images: 'image', courses: 'cap', scholarships: 'award', territory: 'globe', forms: 'file', submission: 'send', logins: 'key', contacts: 'people', basics: 'edit', intakes: 'calendar', fees: 'wallet', academic: 'cap', english: 'doc' };
/** "3 Nov 2026, 11:27 am", as the RP side's timeline writes it. */
const whenText = (iso: string) => {
  const d = new Date(iso.length > 10 ? iso : `${iso}T00:00`);
  return iso.length > 10 ? `${dateText(iso)}, ${d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}` : dateText(iso);
};

/**
 * Logs (3 Nov): every change to a record as a timeline, newest first, like the application's activity on the RP
 * side: what changed, then which part, who and when; it ends with when the record was added. Read-only. `parts`
 * names each part as its tab or section does.
 */
export function Logs({ id, ...t }: { id: string; lines: LogLine[]; created: Stamp; added: string; parts: Record<string, string> }) {
  return (
    <Section title="Logs" id={id}>
      <Timeline {...t} />
    </Section>
  );
}

/** The timeline itself (4 Nov: also folded under an announcement): newest first, 40 at a time, then Show older. */
export function Timeline({ lines, created, added, parts }: { lines: LogLine[]; created: Stamp; added: string; parts: Record<string, string> }) {
  const [n, setN] = useState(PAGE);
  const reduce = useReducedMotion();
  const all: LogLine[] = [...[...lines].sort((a, b) => b.at.localeCompare(a.at)), { id: 'added', at: created.at, by: created.by, part: '', what: added }];
  return (
    <>
      <ol className="aact ilogs">
        {all.slice(0, n).map((l, i) => (
          <motion.li
            key={l.id}
            className="aact__item aact__item--gsp"
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1], delay: Math.min(i, 8) * 0.03 }}
          >
            <span className="aact__icon" aria-hidden="true">
              <Icon name={l.part ? PART_ICON[l.part] ?? 'edit' : 'plus'} size={16} />
            </span>
            <span className="aact__t">
              <span className="aact__text">{l.what}</span>
              <span className="aact__meta">
                {l.part ? `${parts[l.part] ?? l.part} · ` : ''}
                {l.by} · <span className="num">{whenText(l.at)}</span>
              </span>
            </span>
          </motion.li>
        ))}
      </ol>
      {all.length > n && (
        <div className="ilogs__more">
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setN((x) => x + PAGE)}>
            Show {Math.min(PAGE, all.length - n)} older
          </button>
        </div>
      )}
    </>
  );
}
