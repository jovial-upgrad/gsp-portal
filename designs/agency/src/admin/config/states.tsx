import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SelectMenu, type MenuOption } from '../../components/SelectMenu';
import { Toast as SharedToast } from '../../components/Toast';
import './states.css';

/**
 * Page states (PRD slice 1, Page states): every Admin page, list and dialog uses these, with the same copy
 * everywhere. The prototype loads instantly, so the slow and failing states are shown from the Prototype panel's
 * review states (Admin states), which set `sim` below.
 */
export type Sim = 'loading' | 'load-error' | 'save-error' | 'conflict' | 'no-access' | 'not-found' | 'view-only' | null;
let sim: Sim = null;
const subs = new Set<() => void>();
export const setSim = (s: Sim) => {
  sim = s;
  subs.forEach((f) => f());
};
export const getSim = () => sim;
/** The Prototype panel's review states for the page states (PRD slice 1), each opening an Admin page. */
export const ADMIN_STATES: Record<string, { label: string; sim: Sim; section: string }> = {
  'state-ready': { label: 'Loaded (no review state)', sim: null, section: 'users' },
  'state-loading': { label: 'Loading', sim: 'loading', section: 'users' },
  'state-load-error': { label: 'Load error', sim: 'load-error', section: 'users' },
  'state-save-error': { label: 'Save error (try any save)', sim: 'save-error', section: 'regions' },
  'state-conflict': { label: 'Someone else saved (try any save)', sim: 'conflict', section: 'regions' },
  'state-view-only': { label: 'View only', sim: 'view-only', section: 'regions' },
  'state-no-access': { label: 'No access', sim: 'no-access', section: 'users' },
  'state-not-found': { label: 'Not found', sim: 'not-found', section: 'users' },
};
export const useSim = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => sim);

/**
 * A page's load: loading (shown past 300 ms), a load error (failed, or over 10 seconds), or ready. In the
 * prototype it's ready at once unless a review state says otherwise; Try again clears the failure.
 */
export function useLoad() {
  const s = useSim();
  const [tried, setTried] = useState(0);
  const phase: 'loading' | 'error' | 'ready' = s === 'loading' ? 'loading' : s === 'load-error' && !tried ? 'error' : 'ready';
  return { phase, retry: () => (setTried((n) => n + 1), setSim(null)) };
}

/** Loading: the page header and its buttons stay, with 5 grey skeleton rows in the table; buttons are off. */
export function Skeleton({ cols = 4 }: { cols?: number }) {
  return (
    <section className="card stable cfg__skel" aria-busy="true" aria-label="Loading">
      <table className="itab cfg__tab">
        <tbody>
          {Array.from({ length: 5 }, (_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }, (_, j) => (
                <td key={j}>
                  <span className="cfg__skelbar" style={{ width: `${55 + ((i * 7 + j * 13) % 40)}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Load error: a red banner in place of the table, with Try again. */
export function LoadError({ page, onRetry }: { page: string; onRetry: () => void }) {
  return (
    <div className="banner banner--bad cfg__state" role="alert">
      <Icon name="alert" size={18} />
      <div className="banner__body">
        <p>We couldn’t load {page}. Check your connection and try again.</p>
        <Button size="sm" variant="secondary" iconLeft={<Icon name="refresh" size={16} />} onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

/** Where a page goes while it loads or fails: the skeleton or the error, else the page. */
export function Loaded({ page, cols, children }: { page: string; cols?: number; children: ReactNode }) {
  const l = useLoad();
  if (l.phase === 'loading') return <Skeleton cols={cols} />;
  if (l.phase === 'error') return <LoadError page={page} onRetry={l.retry} />;
  return <>{children}</>;
}

/** View only: the page without Add, Edit, row actions or switches, and this grey note under the title. */
export const ViewOnlyNote = () => <p className="cfg__viewonly">You can view this page but not change it.</p>;

/** A full page, for No access and Not found, with Go to Home. */
function FullPage({ title, onHome }: { title: string; onHome: () => void }) {
  return (
    <div className="ipage cfg__full" role="alert">
      <span className="cfg__fullicon" aria-hidden="true">
        <Icon name="lock" size={28} />
      </span>
      <h1 className="page__title">{title}</h1>
      <Button onClick={onHome} iconRight={<Icon name="arrowRight" size={18} />}>
        Go to Home
      </Button>
    </div>
  );
}
/** No access: the role has No access to the page's object, or a direct link to a page it can't open. */
export const NoAccessPage = ({ onHome }: { onHome: () => void }) => <FullPage title="You don’t have access to this page. Ask a GSP Admin if you need it." onHome={onHome} />;
/** Not found: the record doesn't exist, or it's outside the person's sales regions (the same, so nobody learns it exists). */
export const NotFoundPage = ({ onHome }: { onHome: () => void }) => <FullPage title="We can’t find that page." onHome={onHome} />;

/** What a save comes back with: saved, refused (Save error) or someone else saved first. */
export type SaveResult = 'ok' | 'save-error' | 'conflict';
/** In the prototype every save works, unless a review state makes it fail. */
export const trySave = (): SaveResult => (sim === 'save-error' ? 'save-error' : sim === 'conflict' ? 'conflict' : 'ok');

/** Save error and Someone else saved: a banner at the top of the dialog or edit, which stays open with what was typed. */
export function SaveBanner({ result, onReload }: { result: SaveResult | null; onReload?: () => void }) {
  if (!result || result === 'ok') return null;
  if (result === 'save-error')
    return (
      <div className="banner banner--bad cfg__state" role="alert">
        <Icon name="alert" size={18} />
        <p className="banner__body">We couldn’t save your changes. Try again.</p>
      </div>
    );
  return (
    <div className="banner banner--bad cfg__state" role="alert">
      <Icon name="alert" size={18} />
      <div className="banner__body">
        <p>Someone else changed this while you were editing. Reload to see their version.</p>
        {onReload && (
          <Button size="sm" variant="secondary" iconLeft={<Icon name="refresh" size={16} />} onClick={() => (setSim(null), onReload())}>
            Reload
          </Button>
        )}
      </div>
    </div>
  );
}

/** No results: one line in the table, with Clear filters. */
export function NoResults({ thing, onClear }: { thing: string; onClear: () => void }) {
  return (
    <div className="snone" role="status">
      <p className="snone__title">No {thing} match these filters.</p>
      <button type="button" className="btn btn--secondary btn--sm" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}
/** Empty: the page's own line (each page's copy is the PRD's). */
export const Empty = ({ children }: { children: ReactNode }) => <p className="cfg__empty">{children}</p>;

/** Saved: a toast for 4 seconds. */
export function SavedToast({ msg }: { msg: { text: string; key: number } | null }) {
  const [shown, setShown] = useState(msg);
  useEffect(() => setShown(msg), [msg?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <SharedToast ms={4000} t={shown && { key: shown.key, title: shown.text, icon: 'checkCircle', tone: 'ok' }} onClose={() => setShown(null)} />;
}

/**
 * A single select in the portal's own drop-down (no browser select). Options are plain strings or [value, label]
 * pairs; `empty` adds a first choice for "none" (a filter's "All roles").
 */
export function Pick({ id, label, value, options, onChange, placeholder, empty, invalid, describedBy, disabled }: { id: string; label: string; value: string; options: (string | [string, string] | MenuOption)[]; onChange: (v: string) => void; placeholder?: string; empty?: string; invalid?: boolean; describedBy?: string; disabled?: boolean }) {
  const opts: MenuOption[] = [
    ...(empty ? [{ value: '', label: empty }] : []),
    ...options.map((o) => (typeof o === 'string' ? { value: o, label: o } : Array.isArray(o) ? { value: o[0], label: o[1] } : o)),
  ];
  if (disabled) {
    const cur = opts.find((o) => o.value === value);
    return (
      <div className="control is-disabled">
        <span className="control__input cfg__readonly" id={id} aria-label={label}>
          {cur?.label ?? placeholder ?? '–'}
        </span>
      </div>
    );
  }
  return <SelectMenu id={id} label={label} value={value} options={opts} onChange={onChange} placeholder={placeholder ?? empty ?? 'Pick one'} invalid={invalid} describedBy={describedBy} />;
}

/**
 * Admin lists' paging (Jovial, 3 Nov): 20 rows a page by default; the person can pick 10, 20, 50 or 100 rows a page;
 * Previous, the page numbers (first, last and the pages around the current one) and Next. A page-size choice is a
 * display preference, not data.
 */
export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const PAGE_SIZE = 20;

/** Page numbers to show: the first, the last, and one either side of the current one; gaps become "…" (0-based in, 1-based out). */
function pagesAround(page: number, pages: number): (number | '…')[] {
  const cur = page + 1;
  const keep = [...new Set([1, pages, cur - 1, cur, cur + 1].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  keep.forEach((n, i) => {
    if (i && n - keep[i - 1] > 1) out.push(n - keep[i - 1] === 2 ? n - 1 : '…');
    out.push(n);
  });
  return out;
}

/** A list's paging state: the rows on this page and the pager's props. Back to page 1 when `reset` changes. */
export function usePaged<T>(rows: T[], reset: unknown[] = []) {
  const [page, setPage] = useState(0);
  const [per, setPerRaw] = useState<number>(PAGE_SIZE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(0), reset);
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const p = Math.min(page, pages - 1);
  const setPer = (n: number) => (setPerRaw(n), setPage(0));
  return { shown: rows.slice(p * per, (p + 1) * per), pager: { total: rows.length, page: p, setPage, per, setPer } };
}

export function Pager({ total, page, setPage, per = PAGE_SIZE, setPer, thing }: { total: number; page: number; setPage: (n: number) => void; per?: number; setPer?: (n: number) => void; thing: string }) {
  const pages = Math.max(1, Math.ceil(total / per));
  if (total <= PAGE_SIZES[0]) return null;
  const from = page * per + 1;
  const to = Math.min(total, (page + 1) * per);
  const id = `pg-${thing.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <nav className="cfg__pager" aria-label={`${thing} pages`}>
      {setPer && (
        <span className="cfg__per">
          <label htmlFor={id}>Rows per page</label>
          <SelectMenu id={id} label="Rows per page" value={String(per)} options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))} onChange={(v) => setPer(Number(v))} />
        </span>
      )}
      <span className="cfg__muted num cfg__range">
        {from === to ? from : `${from}–${to}`} of {total.toLocaleString('en-GB')}
      </span>
      {pages > 1 && (
        <>
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)} iconLeft={<Icon name="arrowLeft" size={16} />}>
            Previous
          </Button>
          <ol className="cfg__pages">
            {pagesAround(page, pages).map((n, i) =>
              n === '…' ? (
                <li key={`gap-${i}`} className="cfg__pgap" aria-hidden="true">
                  …
                </li>
              ) : (
                <li key={n}>
                  <button type="button" className={`cfg__pnum num ${n === page + 1 ? 'is-on' : ''}`} aria-current={n === page + 1 ? 'page' : undefined} aria-label={`Page ${n}`} onClick={() => n !== page + 1 && setPage(n - 1)}>
                    {n}
                  </button>
                </li>
              ),
            )}
          </ol>
          <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} iconRight={<Icon name="arrowRight" size={16} />}>
            Next
          </Button>
        </>
      )}
    </nav>
  );
}

/** "3 minutes ago", "2 days ago". */
export function ago(at?: number, now = Date.now()) {
  if (!at) return '';
  const m = Math.max(0, Math.round((now - at) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? 'day' : 'days'} ago`;
}
/** Hour of the day in IST (Asia/Kolkata): the one time zone. */
export const istHour = (t = Date.now()) => new Date(t + 5.5 * 3_600_000).getUTCHours();
/** A date in IST, like "24 Oct 2026". */
export const istDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
/** A time in IST, like "14:05". */
export const istTime = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
/** The IST day of a moment, as an ISO day. */
export const istDay = (t: number) => new Date(t + 5.5 * 3_600_000).toISOString().slice(0, 10);
