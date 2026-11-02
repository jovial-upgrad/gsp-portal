import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon';

/**
 * Picks several from a list (29 Oct, 6th round), as the PM prototype's pickers do: a field that says what's picked
 * ("Any" when nothing is, which means all), and a list to tick, with a search for long lists, Clear and Done. The list
 * opens in the overlay layer, so a table or a dialog never clips it. With `all` (29 Oct, 7th round), the list starts
 * with that option ("All countries"), ticked while nothing else is; ticking it clears the rest.
 */
export function MultiPick({ id, label, value, options, onChange, empty = 'Any (empty = all)', search, all, invalid, describedBy, onClose, pageSize, labelOf = (o) => o, noteOf, summarize }: { id: string; label: string; value: string[]; options: string[]; onChange: (v: string[]) => void; empty?: string; search?: boolean; all?: string; /** What an option says, when its value is an id (Find courses' University: the university's name). */ labelOf?: (o: string) => string; /** A note after an option (the University filter's course count). */ noteOf?: (o: string) => string | undefined; /** The field's text for what's picked, in place of "A, B and N more". */ summarize?: (picked: string[]) => string; /** Jovial, 2 Nov: a long list (every RP) shows this many at a time, with Previous and Next. */ pageSize?: number; /** QC, 1 Nov: marked invalid and pointed at its error, like any other field. */ invalid?: boolean; describedBy?: string; /** When the list closes: the field has been left. */ onClose?: () => void }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) onClose?.();
    wasOpen.current = open;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState('');
  const [pg, setPg] = useState(0);
  useEffect(() => setPg(0), [q]);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
  const layer = typeof document === 'undefined' ? null : document.getElementById('layer') ?? document.body;
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && !panel.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  // under the field, as wide as it (at least 260 px); above it when there's no room below
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const h = panel.current?.offsetHeight ?? 320;
      const below = window.innerHeight - r.bottom > h + 12 || r.top < h + 12;
      setAt({ top: below ? r.bottom + 6 : r.top - h - 6, left: Math.min(r.left, window.innerWidth - Math.max(r.width, 260) - 8), width: Math.max(r.width, 260) });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => labelOf(o).toLowerCase().includes(t)) : options;
  }, [q, options, labelOf]);
  const pages = pageSize ? Math.max(1, Math.ceil(shown.length / pageSize)) : 1;
  const onPage = pageSize ? shown.slice(Math.min(pg, pages - 1) * pageSize, (Math.min(pg, pages - 1) + 1) * pageSize) : shown;
  const names = value.map(labelOf);
  const summary = !value.length ? empty : summarize ? summarize(value) : names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
  return (
    <div
      ref={box}
      className={`imp ${open ? 'is-open' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button id={id} type="button" className={`control imp__btn ${invalid ? 'is-invalid' : ''}`} aria-expanded={open} aria-controls={listId} aria-label={`${label}: ${summary}`} aria-invalid={invalid || undefined} aria-describedby={describedBy ?? (invalid ? `${id}-error` : undefined)} onClick={() => setOpen((v) => !v)}>
        <span className={`imp__v ${value.length || all ? '' : 'is-empty'}`}>{summary}</span>
        <Icon name="chevronDown" size={18} />
      </button>
      {open &&
        layer &&
        createPortal(
        <div
          ref={panel}
          className="imp__panel"
          id={listId}
          role="group"
          aria-label={label}
          style={at ? { top: at.top, left: at.left, width: at.width } : { visibility: 'hidden' }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setOpen(false);
              box.current?.querySelector('button')?.focus();
            }
          }}
        >
          {search && (
            <label className="imp__search">
              <Icon name="search" size={16} />
              <span className="vh">Search {label.toLowerCase()}</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" autoFocus />
            </label>
          )}
          <ul className="imp__list">
            {all && !q.trim() && (
              <li>
                <label className="imp__opt imp__opt--all">
                  <input type="checkbox" checked={!value.length} onChange={() => onChange([])} />
                  <span>{all}</span>
                </label>
              </li>
            )}
            {onPage.map((o) => {
              const on = value.includes(o);
              return (
                <li key={o}>
                  <label className="imp__opt">
                    <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} />
                    <span>{labelOf(o)}</span>
                    {noteOf?.(o) && <span className="imp__note num">{noteOf(o)}</span>}
                  </label>
                </li>
              );
            })}
            {!shown.length && <li className="imp__none">Nothing matches “{q}”</li>}
          </ul>
          {pageSize && pages > 1 && (
            <div className="imp__pager">
              <button type="button" className="icon-btn" aria-label="Previous page" disabled={pg <= 0} onClick={() => setPg((p) => Math.max(0, p - 1))}>
                <Icon name="chevronLeft" size={16} />
              </button>
              <span className="num">
                {Math.min(pg, pages - 1) * pageSize + 1}–{Math.min(shown.length, (Math.min(pg, pages - 1) + 1) * pageSize)} of {shown.length}
              </span>
              <button type="button" className="icon-btn" aria-label="Next page" disabled={pg >= pages - 1} onClick={() => setPg((p) => Math.min(pages - 1, p + 1))}>
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
          )}
          <div className="imp__acts">
            <button type="button" className="btn btn--link" onClick={() => onChange([])}>
              Clear
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>,
          layer,
        )}
    </div>
  );
}
