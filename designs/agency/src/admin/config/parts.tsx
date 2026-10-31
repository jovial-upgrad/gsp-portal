import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useUnsaved } from '../../components/unsaved';
import { fmtWhen } from '../../data/format';
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

export const when = (at: number) => fmtWhen(at);

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
 * draft and only kept when Save is clicked. Cancel throws the draft away. QC, 1 Nov: while there are changes, leaving
 * the page asks "Discard changes?" (the shared guard); `what` names them in that question.
 */
export function useDraft<T>(saved: T, what?: string) {
  const [draft, setDraft] = useState<T | null>(null);
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsaved(draft !== null, dirty, { onDiscard: () => setDraft(null), what, esc: false });
  return {
    editing: draft !== null,
    value: draft ?? saved,
    dirty,
    set: (fn: (t: T) => T) => setDraft((d) => fn(d ?? saved)),
    start: () => setDraft(structuredClone(saved)),
    stop: () => setDraft(null),
  };
}

/** A cell's error, under its input in a table. */
export function CellError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <span className="field__msg field__msg--error cfg__cellerr" id={`${id}-error`} role="alert">
      {children}
    </span>
  );
}

/**
 * The Edit / Cancel / Save buttons for a page (or a panel) in edit-then-save mode. Save waits for a change; `name`
 * gives Edit its full name for screen readers ("Edit currency exchange"). When editing ends, focus goes back to Edit.
 */
export function EditBar({ editing, dirty, onEdit, onCancel, onSave, label = 'Edit', name }: { editing: boolean; dirty: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void; label?: string; name?: string }) {
  const edit = useRef<HTMLButtonElement>(null);
  const was = useRef(editing);
  useEffect(() => {
    if (was.current && !editing) window.setTimeout(() => edit.current?.focus(), 30);
    was.current = editing;
  }, [editing]);
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
    <Button ref={edit} variant="secondary" iconLeft={<Icon name="edit" size={18} />} aria-label={name ? `${label} ${name}` : undefined} onClick={onEdit}>
      {label}
    </Button>
  );
}
