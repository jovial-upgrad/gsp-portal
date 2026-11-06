import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EditOnly } from '../../proto/viewOnly';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon';
import '../../components/multipick.css';

/**
 * Several places picked from a list (Nesil, 4 Nov, later: a Master Partner's countries, states and cities): the
 * shared MultiPick, with a search, and, with `free`, one not in the list can be added as typed ("Add “Thane”", or
 * Enter). It can show as invalid, and waits (`disabled`, with `empty` saying why) until there's something to pick
 * from. The list opens in the overlay layer, so the pop-up never clips it.
 */
export function Places({ id, label, value, options, onChange, empty, free, invalid, disabled, describedBy }: { id: string; label: string; value: string[]; options: string[]; onChange: (v: string[]) => void; empty: string; free?: boolean; invalid?: boolean; disabled?: boolean; describedBy?: string }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
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
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);
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
  // what's picked stays in the list, so it can be unticked, even when it was typed in
  const all = useMemo(() => [...new Set([...options, ...value])], [options, value]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? all.filter((o) => o.toLowerCase().includes(t)) : all;
  }, [q, all]);
  const typed = q.trim();
  const canAdd = free && typed.length > 1 && !all.some((o) => o.toLowerCase() === typed.toLowerCase());
  const add = () => {
    if (!canAdd) return;
    onChange([...value, typed]);
    setQ('');
  };
  const summary = !value.length ? empty : value.length <= 2 ? value.join(', ') : `${value.slice(0, 2).join(', ')} and ${value.length - 2} more`;
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
      <button
        id={id}
        type="button"
        className={`control imp__btn ${invalid ? 'is-invalid' : ''}`}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${summary}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`imp__v ${value.length ? '' : 'is-empty'}`}>{summary}</span>
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
            <label className="imp__search">
              <Icon name="search" size={16} />
              <span className="vh">Search {label.toLowerCase()}</span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={free ? 'Search, or type one to add' : 'Search'}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  if (canAdd) add();
                  else if (shown.length === 1 && !value.includes(shown[0])) onChange([...value, shown[0]]);
                }}
              />
            </label>
            <ul className="imp__list">
              {shown.map((o) => {
                const on = value.includes(o);
                return (
                  <li key={o}>
                    <label className="imp__opt">
                      <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} />
                      <span>{o}</span>
                    </label>
                  </li>
                );
              })}
              {canAdd && (
                <li>
                  <EditOnly>
                    <button type="button" className="imp__opt ops-addopt" onClick={add}>
                      <Icon name="plus" size={16} />
                      <span>Add “{typed}”</span>
                    </button>
                  </EditOnly>
                </li>
              )}
              {!shown.length && !canAdd && <li className="imp__none">{q ? `Nothing matches “${q}”` : 'Nothing to pick yet'}</li>}
            </ul>
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
