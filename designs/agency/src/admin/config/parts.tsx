import { useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
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

/**
 * Edit, then Save (Jovial, 31 Oct): a page's settings are read-only until Edit is clicked; changes are made on a
 * draft and only kept when Save is clicked. Cancel throws the draft away.
 */
export function useDraft<T>(saved: T) {
  const [draft, setDraft] = useState<T | null>(null);
  return {
    editing: draft !== null,
    value: draft ?? saved,
    dirty: draft !== null && JSON.stringify(draft) !== JSON.stringify(saved),
    set: (fn: (t: T) => T) => setDraft((d) => fn(d ?? saved)),
    start: () => setDraft(structuredClone(saved)),
    stop: () => setDraft(null),
  };
}

/** The Edit / Cancel / Save buttons for a page (or a panel) in edit-then-save mode. */
export function EditBar({ editing, dirty, onEdit, onCancel, onSave, label = 'Edit' }: { editing: boolean; dirty: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void; label?: string }) {
  return editing ? (
    <span className="cfg__editbar">
      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button onClick={onSave} disabled={!dirty}>
        Save
      </Button>
    </span>
  ) : (
    <Button variant="secondary" iconLeft={<Icon name="edit" size={18} />} onClick={onEdit}>
      {label}
    </Button>
  );
}
