import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { LogEntry } from '../data/config';

/** A delete or remove, asked first: its title, the button that does it, what happens, and what it does. */
export type Ask = { title: string; confirm: string; body?: ReactNode; run: () => void };
/**
 * Asked first (Nesil, 4 Nov): every delete or remove on these pages waits for a yes, rows taken out while editing
 * included. `ask({ title, confirm, body, run })` opens the question; put the returned dialog anywhere on the page.
 */
export function useAsk(): [(a: Ask) => void, ReactNode] {
  const [a, setA] = useState<Ask | null>(null);
  const dialog = (
    <ConfirmDialog
      open={!!a}
      title={a?.title ?? ''}
      confirm={a?.confirm ?? ''}
      cancel="Keep"
      onCancel={() => setA(null)}
      onConfirm={() => {
        a?.run();
        setA(null);
      }}
    >
      {typeof a?.body === 'string' ? <p>{a.body}</p> : a?.body}
    </ConfirmDialog>
  );
  return [setA, dialog];
}

/** A configuration section: a card with its title, a line on what it does, and its action. */
export function Panel({ title, note, action, children, flush = false }: { title?: string; note?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className={`card cfg__panel ${flush ? 'is-flush' : ''}`}>
      {(title || action) && (
        <div className="cfg__phead">
          <div className="cfg__pt">
            {title && <h2 className="cfg__title">{title}</h2>}
            {note && <p className="cfg__note">{note}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export const when = (at: number) => {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? 'Today' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

/** The last changes made here, newest first (all of them are on Logs). Called Logs too since 4 Nov (Nesil). */
export function History({ log, area }: { log: LogEntry[]; area: string }) {
  const mine = log.filter((l) => l.kind === 'change' && l.area === area).slice(0, 10);
  return (
    <details className="cfg__history">
      <summary>Logs ({log.filter((l) => l.kind === 'change' && l.area === area).length})</summary>
      {mine.length ? (
        <ol className="aact ilogs cfg__timeline">
          {mine.map((l) => (
            <li key={l.id} className="aact__item aact__item--gsp">
              <span className="aact__icon" aria-hidden="true">
                <Icon name="edit" size={16} />
              </span>
              <span className="aact__t">
                <span className="aact__text">{l.text}</span>
                <span className="aact__meta">
                  {l.who} · <time className="num">{when(l.at)}</time>
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="cfg__note">No changes yet.</p>
      )}
    </details>
  );
}

/** Rows a page (Nesil, 3 Nov): long tables show 20 at a time. */
export const PER_PAGE = 20;
export type Paged<T> = { rows: T[]; page: number; pages: number; setPage: (n: number) => void; from: number; to: number; total: number };
/** The rows on the current page; back to the first page when `reset` changes (a filter, a search). */
export function usePaged<T>(all: T[], reset: unknown[] = [], per = PER_PAGE): Paged<T> {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), reset); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(all.length / per));
  const p = Math.min(page, pages);
  return { rows: all.slice((p - 1) * per, p * per), page: p, pages, setPage, from: all.length ? (p - 1) * per + 1 : 0, to: Math.min(p * per, all.length), total: all.length };
}

/** Under a table: which rows show, and the pages (with Previous and Next) when there's more than one. */
export function Pager<T>({ pg, what }: { pg: Paged<T>; what: string }) {
  if (pg.pages <= 1) return null;
  // the first, the last, and the two either side of the current page
  const nums = Array.from({ length: pg.pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pg.pages || Math.abs(n - pg.page) <= 1);
  return (
    <nav className="cfg__pager" aria-label={`Pages of ${what}`}>
      <p className="cfg__pager-n" role="status">
        Showing <span className="num">{pg.from}</span>–<span className="num">{pg.to}</span> of <span className="num">{pg.total}</span> {what}
      </p>
      <div className="cfg__pager-btns">
        <button type="button" className="cfg__pg" disabled={pg.page === 1} onClick={() => pg.setPage(pg.page - 1)} aria-label="Previous page">
          <Icon name="arrowLeft" size={16} />
        </button>
        {nums.map((n, i) => (
          <span key={n} className="cfg__pg-wrap">
            {i > 0 && n - nums[i - 1] > 1 && <span className="cfg__pg-gap" aria-hidden="true">…</span>}
            <button type="button" className="cfg__pg num" aria-current={n === pg.page ? 'page' : undefined} aria-label={`Page ${n}`} onClick={() => pg.setPage(n)}>
              {n}
            </button>
          </span>
        ))}
        <button type="button" className="cfg__pg" disabled={pg.page === pg.pages} onClick={() => pg.setPage(pg.page + 1)} aria-label="Next page">
          <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </nav>
  );
}

/**
 * Edit, then Save (Nesil, 3 Nov): a page reads as it is until Edit; then Cancel puts it back and Save keeps the
 * changes, once there are some.
 */
export function EditActions({ editing, dirty, onEdit, onCancel, onSave, disabled }: { editing: boolean; dirty: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void; disabled?: boolean }) {
  return editing ? (
    <span className="cfg__editacts">
      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button iconLeft={<Icon name="check" size={16} />} disabled={!dirty} onClick={onSave}>
        Save Changes
      </Button>
    </span>
  ) : (
    <Button variant="secondary" iconLeft={<Icon name="edit" size={16} />} disabled={disabled} onClick={onEdit}>
      Edit
    </Button>
  );
}
