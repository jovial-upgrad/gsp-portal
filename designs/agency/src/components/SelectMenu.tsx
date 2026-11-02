import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { useAnchoredPopup } from './popup';
import './combobox.css';

/** One choice: what it says, an optional note after it ("now"), the group it's listed under, and whether it can be picked. */
export type MenuOption = { value: string; label: string; note?: string; group?: string; disabled?: boolean };

/** Lists longer than this get a search box at the top (Jovial, 2 Nov). */
export const SEARCH_FROM = 10;

/**
 * A select that drops down from its field (ARIA 1.2 select-only combobox), never the system's own list (Jovial,
 * 2 Nov: no system UI). The list renders into the overlay layer, so a dialog never clips it, and is placed under the
 * field (above it only when there's no room below). Arrow keys, Home, End and typing move through it; Enter or Space
 * picks; Escape closes it and leaves the dialog open. A list of more than ten has a search box: typing filters it.
 *
 * `bare` drops the field's frame for a trigger styled by its own `className` (the student bar in Find courses, the
 * dial code in a phone field); `render` draws the trigger's text.
 */
export function SelectMenu({
  id,
  value,
  options,
  onChange,
  placeholder = 'Pick one',
  label,
  labelledBy,
  invalid,
  describedBy,
  disabled,
  search,
  onBlur,
  className = '',
  bare = false,
  render,
  host,
  minWidth,
  chevron = true,
  emptyText = 'Nothing matches',
  ariaLabel,
}: {
  id?: string;
  value: string;
  options: MenuOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  /** The list's name for screen readers. */
  label: string;
  labelledBy?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  /** A search box over the list; on by itself for more than ten choices. */
  search?: boolean;
  onBlur?: () => void;
  className?: string;
  bare?: boolean;
  render?: (picked: MenuOption | undefined) => ReactNode;
  host?: 'layer' | 'body';
  minWidth?: number;
  chevron?: boolean;
  emptyText?: string;
  /** Names the field itself when no visible label points at it. */
  ariaLabel?: string;
}) {
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const find = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const searchable = search ?? options.length > SEARCH_FROM;
  const picked = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => `${o.label} ${o.note ?? ''} ${o.group ?? ''}`.toLowerCase().includes(t));
  }, [options, q]);
  const close = (focus = true) => {
    setOpen(false);
    setQ('');
    if (focus) btn.current?.focus();
  };
  const { into, style, at } = useAnchoredPopup(bare ? btn : wrap, pop, open, { host, minWidth: minWidth ?? (bare ? 260 : 0), onAway: () => close(false) });

  useEffect(() => {
    if (open) pop.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, at]);
  useEffect(() => {
    if (open && searchable) window.setTimeout(() => find.current?.focus(), 0);
  }, [open, searchable]);

  const enabled = (list: MenuOption[], from: number, dir: 1 | -1) => {
    for (let i = from; i >= 0 && i < list.length; i += dir) if (!list[i].disabled) return i;
    return -1;
  };
  const show = (seed = '') => {
    if (disabled) return;
    setQ(seed);
    const i = seed ? 0 : options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : Math.max(0, enabled(options, 0, 1)));
    setOpen(true);
  };
  const pick = (i: number) => {
    const o = shown[i];
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close();
  };
  // typing a few letters goes to the first choice that starts with them
  const seek = (ch: string) => {
    const now = Date.now();
    typed.current = { text: now - typed.current.at < 700 ? typed.current.text + ch : ch, at: now };
    const t = typed.current.text.toLowerCase();
    const from = open ? active : options.findIndex((o) => o.value === value);
    const order = [...options.keys()].map((k) => (k + Math.max(0, from) + (t.length === 1 ? 1 : 0)) % options.length);
    const i = order.find((k) => !options[k].disabled && options[k].label.toLowerCase().startsWith(t));
    if (i === undefined) return;
    setActive(i);
    if (!open) setOpen(true);
  };
  const move = (e: React.KeyboardEvent, typing: boolean) => {
    const last = shown.length - 1;
    if (e.key === 'ArrowDown') setActive((x) => { const n = enabled(shown, x + 1, 1); return n < 0 ? x : n; });
    else if (e.key === 'ArrowUp') setActive((x) => { const n = enabled(shown, x - 1, -1); return n < 0 ? x : n; });
    else if ((!typing && e.key === 'Home') || e.key === 'PageUp') setActive(Math.max(0, enabled(shown, 0, 1)));
    else if ((!typing && e.key === 'End') || e.key === 'PageDown') setActive(Math.max(0, enabled(shown, last, -1)));
    else if (e.key === 'Enter' || (!typing && e.key === ' ')) pick(active);
    else if (e.key === 'Escape') {
      // closes the list, not the dialog it's in
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
      return;
    } else if (!typing && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) seek(e.key);
    else return;
    e.preventDefault();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (searchable) {
          e.preventDefault();
          show(e.key);
        } else seek(e.key);
      }
      return;
    }
    move(e, false);
  };
  const left = (e: React.FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && (wrap.current?.contains(to) || pop.current?.contains(to))) return;
    if (open && !to) return; // a press inside the list (it keeps focus where it was)
    if (open) close(false);
    onBlur?.();
  };

  let group: string | undefined;
  const frame = bare ? `smenu smenu--bare ${className}` : `control smenu ${className}`;
  return (
    <div ref={wrap} className={`${frame} ${invalid ? 'is-invalid' : ''} ${open ? 'is-open' : ''} ${picked ? '' : 'is-empty'} ${disabled ? 'is-disabled' : ''}`}>
      <button
        ref={btn}
        id={id}
        type="button"
        className={bare ? 'smenu__btn smenu__btn--bare' : 'control__input smenu__btn'}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${listId}-list`}
        aria-activedescendant={open && !searchable && shown[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-label={ariaLabel ?? (labelledBy ? undefined : bare || !id ? label : undefined)}
        aria-labelledby={labelledBy}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKey}
        onBlur={left}
      >
        {render ? render(picked) : (
          <>
            <span className="smenu__value">{picked ? picked.label : placeholder}</span>
            {picked?.note && <span className="smenu__note">{picked.note}</span>}
          </>
        )}
      </button>
      {chevron && (
        <span className="control__chevron smenu__chev" aria-hidden="true">
          <Icon name="chevronDown" size={bare ? 16 : 18} />
        </span>
      )}
      {open &&
        style &&
        into &&
        createPortal(
          <div ref={pop} className={`cbx__list smenu__list ${at?.up ? 'is-up' : ''} ${searchable ? 'has-search' : ''}`} style={style} onBlur={left}>
            {searchable && (
              <div className="smenu__search">
                <Icon name="search" size={16} />
                <input
                  ref={find}
                  type="search"
                  className="smenu__find"
                  role="combobox"
                  aria-label={`Search: ${label}`}
                  aria-expanded
                  aria-controls={`${listId}-list`}
                  aria-autocomplete="list"
                  aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                  placeholder="Search"
                  autoComplete="off"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={(e) => move(e, true)}
                />
              </div>
            )}
            <ul id={`${listId}-list`} role="listbox" aria-label={label} className="smenu__opts">
              {!shown.length && (
                <li role="presentation" className="cbx__empty">
                  {emptyText}
                </li>
              )}
              {shown.map((o, i) => {
                const head = o.group && o.group !== group ? o.group : undefined;
                group = o.group;
                return [
                  head && (
                    <li key={`g-${head}-${i}`} role="presentation" className="cbx__group">
                      {head}
                    </li>
                  ),
                  <li
                    key={`${o.value}-${i}`}
                    id={`${listId}-${i}`}
                    data-index={i}
                    data-value={o.value}
                    role="option"
                    aria-selected={o.value === value}
                    aria-disabled={o.disabled || undefined}
                    className={`cbx__opt ${i === active ? 'is-active' : ''} ${o.disabled ? 'is-disabled' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => !o.disabled && setActive(i)}
                    onClick={() => pick(i)}
                  >
                    <span className="cbx__name">{o.label}</span>
                    {o.note && <span className="cbx__dial">{o.note}</span>}
                    {o.value === value && <Icon name="check" size={16} className="cbx__tick" />}
                  </li>,
                ];
              })}
            </ul>
          </div>,
          into,
        )}
    </div>
  );
}
