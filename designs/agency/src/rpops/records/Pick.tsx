import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon';
import type { PickOption } from '../../institution/records/SearchPick';
import '../../components/combobox.css';

/**
 * A searchable picker for RP Ops' pop-ups (4 Nov, later): GSP · Institution's SearchPick, with its list in the overlay
 * layer. Inside a pop-up, SearchPick's list opened in the pop-up's scrolling body and was cut off after one row (Link
 * an RP). Here it drops under the field (above it when there's no room), over the pop-up's edges. Typing filters by
 * name or note; arrows, Home and End move; Enter or a click picks; Escape closes the list (not the pop-up) and goes
 * back to what was picked.
 */
export function Pick({ id, value, options, onChange, invalid, describedBy, label, placeholder = 'Type to search' }: { id: string; value: string; options: PickOption[]; onChange: (v: string) => void; invalid?: boolean; describedBy?: string; label: string; placeholder?: string }) {
  const listId = useId();
  const picked = options.find((o) => o.value === value);
  const [query, setQuery] = useState(picked?.label ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [at, setAt] = useState<{ top?: number; bottom?: number; left: number; width: number; max: number; up: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const layer = typeof document === 'undefined' ? null : document.getElementById('layer');
  useEffect(() => setQuery(picked?.label ?? ''), [picked?.label]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === picked?.label.toLowerCase()) return options;
    return options.filter((o) => `${o.label} ${o.note ?? ''}`.toLowerCase().includes(q)).sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)));
  }, [query, options, picked?.label]);

  // under the field, as wide as it; above it when the room below is short and there's more above
  const place = () => {
    const r = box.current?.querySelector('.control')?.getBoundingClientRect();
    if (!r || !layer) return;
    const l = layer.getBoundingClientRect();
    const below = l.bottom - r.bottom - 12;
    const above = r.top - l.top - 12;
    const up = below < 220 && above > below;
    setAt({ ...(up ? { bottom: l.bottom - r.top + 6 } : { top: r.bottom - l.top + 6 }), left: r.left - l.left, width: r.width, max: Math.min(300, up ? above : below), up });
  };
  useLayoutEffect(() => {
    if (open) place();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const move = () => place();
    window.addEventListener('resize', move);
    window.addEventListener('scroll', move, true);
    return () => {
      window.removeEventListener('resize', move);
      window.removeEventListener('scroll', move, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, at]);

  const pick = (o: PickOption) => {
    if (o.value !== value) onChange(o.value);
    setQuery(o.label);
    setOpen(false);
  };
  const openList = () => {
    setOpen(true);
    const i = shown.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
  };

  return (
    <div ref={box} className={`cbx ${open ? 'is-open' : ''}`}>
      <div className={`control ${invalid ? 'is-invalid' : ''}`}>
        <span className="control__leading">
          <Icon name="search" size={18} />
        </span>
        <input
          ref={input}
          id={id}
          className="control__input"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={(e) => e.target.select()}
          onClick={() => !open && openList()}
          onKeyDown={(e) => {
            const last = shown.length - 1;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!open) return openList();
              setActive((a) => Math.min(a + 1, last));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (!open) return openList();
              setActive((a) => Math.max(a - 1, 0));
            } else if (open && (e.key === 'Home' || e.key === 'End') && !query) {
              e.preventDefault();
              setActive(e.key === 'Home' ? 0 : last);
            } else if (e.key === 'Enter') {
              if (open && shown[active]) {
                e.preventDefault();
                pick(shown[active]);
              }
            } else if (e.key === 'Escape' && open) {
              // closes the list, not the pop-up it's in
              e.stopPropagation();
              setOpen(false);
              setQuery(picked?.label ?? '');
            } else if (e.key === 'Tab') setOpen(false);
          }}
          onBlur={() =>
            window.setTimeout(() => {
              if (document.activeElement === input.current) return;
              const exact = options.find((o) => o.label.toLowerCase() === query.trim().toLowerCase());
              if (exact && exact.value !== value) onChange(exact.value);
              else setQuery(exact ? exact.label : picked?.label ?? '');
              setOpen(false);
            }, 120)
          }
        />
        <button
          type="button"
          className="cbx__toggle"
          tabIndex={-1}
          aria-label={open ? `Close the ${label.toLowerCase()} list` : `Open the ${label.toLowerCase()} list`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) setOpen(false);
            else {
              input.current?.focus();
              openList();
            }
          }}
        >
          <Icon name="chevronDown" size={18} />
        </button>
      </div>
      {open &&
        at &&
        layer &&
        createPortal(
          <ul
            ref={list}
            id={`${listId}-list`}
            role="listbox"
            aria-label={label}
            className={`cbx__list smenu__list ops-picklist ${at.up ? 'is-up' : ''}`}
            style={{ top: at.top ?? 'auto', bottom: at.bottom ?? 'auto', left: at.left, width: at.width, maxHeight: at.max }}
            // the list never takes focus: the cursor stays in the field
            onMouseDown={(e) => e.preventDefault()}
          >
            {shown.length === 0 && <li className="cbx__empty">Nothing matches “{query}”</li>}
            {shown.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                data-value={o.value}
                role="option"
                aria-selected={o.value === value}
                className={`cbx__opt ${i === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
              >
                <span className="cbx__name">{o.label}</span>
                {o.note && <span className="cbx__dial">{o.note}</span>}
                {o.value === value && <Icon name="check" size={16} className="cbx__tick" />}
              </li>
            ))}
          </ul>,
          layer,
        )}
    </div>
  );
}
