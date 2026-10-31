import type { ReactNode } from 'react';
import type { LogEntry } from '../data/config';

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

/** The last changes made here, newest first (all of them are on Logs). */
export function History({ log, area }: { log: LogEntry[]; area: string }) {
  const mine = log.filter((l) => l.kind === 'change' && l.area === area).slice(0, 10);
  return (
    <details className="cfg__history">
      <summary>Change history ({log.filter((l) => l.kind === 'change' && l.area === area).length})</summary>
      {mine.length ? (
        <ul>
          {mine.map((l) => (
            <li key={l.id}>
              <time className="num">{when(l.at)}</time>
              <span>
                {l.text} · {l.who}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cfg__note">No changes yet.</p>
      )}
    </details>
  );
}
