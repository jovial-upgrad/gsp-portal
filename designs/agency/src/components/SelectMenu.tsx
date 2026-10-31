import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import './combobox.css';

/** One choice: what it says, an optional note after it ("now"), and the group it's listed under. */
export type MenuOption = { value: string; label: string; note?: string; group?: string };

/**
 * A select that drops down from its field (ARIA 1.2 select-only combobox), where a native select would open
 * the system's own list somewhere else. The list renders into the overlay layer, so a dialog never clips it,
 * and is placed under the field (above it only when there's no room below). Arrow keys, Home, End and typing
 * move through it; Enter or Space picks; Escape closes it and leaves the dialog open.
 */
export function SelectMenu({
  id,
  value,
  options,
  onChange,
  placeholder = 'Pick one',
  label,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  options: MenuOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  /** The list's name for screen readers. */
  label: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [at, setAt] = useState<{ top?: number; bottom?: number; left: number; width: number; max: number; up: boolean } | null>(null);
  const layer = typeof document === 'undefined' ? null : document.getElementById('layer');
  const picked = options.find((o) => o.value === value);

  // under the field, as wide as it; above it when the room below is short and there's more above
  const place = () => {
    if (!btn.current || !layer) return;
    const r = btn.current.closest('.control')!.getBoundingClientRect();
    const box = layer.getBoundingClientRect();
    const below = box.bottom - r.bottom - 12;
    const above = r.top - box.top - 12;
    const up = below < 220 && above > below;
    const max = Math.min(320, up ? above : below);
    setAt({ ...(up ? { bottom: box.bottom - r.top + 6 } : { top: r.bottom - box.top + 6 }), left: r.left - box.left, width: r.width, max, up });
  };
  useLayoutEffect(() => {
    if (open) place();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    const move = () => place();
    document.addEventListener('mousedown', away);
    window.addEventListener('resize', move);
    window.addEventListener('scroll', move, true);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('resize', move);
      window.removeEventListener('scroll', move, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, at]);

  const show = () => {
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  };
  const pick = (i: number) => {
    const o = options[i];
    if (o && o.value !== value) onChange(o.value);
    setOpen(false);
    btn.current?.focus();
  };
  // typing a few letters goes to the first choice that starts with them
  const seek = (ch: string) => {
    const now = Date.now();
    typed.current = { text: now - typed.current.at < 700 ? typed.current.text + ch : ch, at: now };
    const q = typed.current.text.toLowerCase();
    const from = open ? active : options.findIndex((o) => o.value === value);
    const order = [...options.keys()].map((k) => (k + Math.max(0, from) + (q.length === 1 ? 1 : 0)) % options.length);
    const i = order.find((k) => options[k].label.toLowerCase().startsWith(q));
    if (i === undefined) return;
    setActive(i);
    if (!open) setOpen(true);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) seek(e.key);
      return;
    }
    if (e.key === 'ArrowDown') setActive((x) => Math.min(x + 1, last));
    else if (e.key === 'ArrowUp') setActive((x) => Math.max(x - 1, 0));
    else if (e.key === 'Home' || e.key === 'PageUp') setActive(0);
    else if (e.key === 'End' || e.key === 'PageDown') setActive(last);
    else if (e.key === 'Enter' || e.key === ' ') pick(active);
    else if (e.key === 'Escape') {
      // closes the list, not the dialog it's in
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Tab') return setOpen(false);
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) seek(e.key);
    else return;
    e.preventDefault();
  };

  let group: string | undefined;
  return (
    <div className={`control smenu ${invalid ? 'is-invalid' : ''} ${open ? 'is-open' : ''} ${picked ? '' : 'is-empty'}`}>
      <button
        ref={btn}
        id={id}
        type="button"
        className="control__input smenu__btn"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${listId}-list`}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        <span className="smenu__value">{picked ? picked.label : placeholder}</span>
        {picked?.note && <span className="smenu__note">{picked.note}</span>}
      </button>
      <span className="control__chevron smenu__chev" aria-hidden="true">
        <Icon name="chevronDown" size={18} />
      </span>
      {open &&
        at &&
        layer &&
        createPortal(
          <ul
            ref={list}
            id={`${listId}-list`}
            role="listbox"
            aria-label={label}
            className={`cbx__list smenu__list ${at.up ? 'is-up' : ''}`}
            style={{ top: at.top ?? 'auto', bottom: at.bottom ?? 'auto', left: at.left, width: at.width, maxHeight: at.max }}
          >
            {options.map((o, i) => {
              const head = o.group && o.group !== group ? o.group : undefined;
              group = o.group;
              return [
                head && (
                  <li key={`g-${head}`} role="presentation" className="cbx__group">
                    {head}
                  </li>
                ),
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  data-index={i}
                  data-value={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  className={`cbx__opt ${i === active ? 'is-active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(i)}
                >
                  <span className="cbx__name">{o.label}</span>
                  {o.note && <span className="cbx__dial">{o.note}</span>}
                  {o.value === value && <Icon name="check" size={16} className="cbx__tick" />}
                </li>,
              ];
            })}
          </ul>,
          layer,
        )}
    </div>
  );
}
