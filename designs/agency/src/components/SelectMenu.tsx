import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import './combobox.css';

/** One choice: what it says, an optional note after it ("now"), the group it's listed under, and whether it can be
 *  picked. `tone: 'end'`: it closes something, in grey with a cross. */
export type MenuOption = { value: string; label: string; note?: string; group?: string; disabled?: boolean; tone?: 'end' };

/**
 * GSP's dropdown (Nesil, 4 Nov: one in every role, never the browser's own list). A button that shows the choice
 * (ARIA 1.2 select-only combobox), and a white list that drops from the field, as wide as it: it renders into the
 * overlay layer, so a pop-up or a table never clips it, and opens above the field only when there's no room below.
 * Arrow keys, Home, End and typing move through it; Enter or Space picks; Escape closes it and leaves a pop-up open;
 * a click outside closes it. Every select in the product is this: `SelectInput` (forms) and `SelectMenu` use it.
 */
export function Dropdown({
  id,
  value,
  options,
  onPick,
  placeholder = 'Pick one',
  listLabel,
  ariaLabel,
  labelledBy,
  describedBy,
  invalid,
  disabled,
  wrapClass,
  btnClass = 'control__input smenu__btn',
  display,
  before,
  minListWidth = 200,
  anchorTo = '.control, .dd',
  chevron = true,
}: {
  /** The button's id: a label's `htmlFor` names it. */
  id?: string;
  value: string;
  options: MenuOption[];
  onPick: (v: string) => void;
  placeholder?: string;
  /** The list's name for screen readers (defaults to the field's). */
  listLabel?: string;
  ariaLabel?: string;
  labelledBy?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** The field around the button (the `.control` box, or a compact variant). */
  wrapClass: string;
  btnClass?: string;
  /** What the button shows for the choice; the label (and note) by default. */
  display?: (picked: MenuOption | undefined) => ReactNode;
  /** Inside the field, before the button: a leading icon, or the hidden native select that carries the value. */
  before?: ReactNode;
  minListWidth?: number;
  /** What the list drops from and is as wide as: the field by default, or a larger box around it (the phone field). */
  anchorTo?: string;
  /** Off when the field draws its own arrow. */
  chevron?: boolean;
}) {
  const listId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [at, setAt] = useState<{ top?: number; bottom?: number; left: number; width: number; max: number; up: boolean; fixed: boolean } | null>(null);
  const layer = typeof document === 'undefined' ? null : (document.getElementById('layer') ?? document.body);
  const picked = options.find((o) => o.value === value);
  const enabled = (i: number) => !!options[i] && !options[i].disabled;

  // under the field, at least as wide as it; above it when the room below is short and there's more above
  const place = () => {
    if (!btn.current || !layer) return;
    const field = (btn.current.closest(anchorTo) as HTMLElement | null) ?? btn.current;
    const r = field.getBoundingClientRect();
    const fixed = layer === document.body;
    const box = fixed ? { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth } : layer.getBoundingClientRect();
    const below = box.bottom - r.bottom - 12;
    const above = r.top - box.top - 12;
    const up = below < 220 && above > below;
    const max = Math.min(320, up ? above : below);
    const width = Math.max(r.width, minListWidth);
    const left = Math.min(r.left - box.left, (box.right - box.left) - width - 8);
    setAt({ ...(up ? { bottom: box.bottom - r.top + 6 } : { top: r.bottom - box.top + 6 }), left: Math.max(8, left), width, max, up, fixed });
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
    const move = (e?: Event) => {
      // the list's own scrolling doesn't move it
      if (e && list.current && e.target instanceof Node && list.current.contains(e.target)) return;
      place();
    };
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
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const show = () => {
    if (disabled) return;
    const i = options.findIndex((o) => o.value === value && !o.disabled);
    setActive(i >= 0 ? i : Math.max(0, options.findIndex((o) => !o.disabled)));
    setOpen(true);
  };
  const pick = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (o.value !== value) onPick(o.value);
    setOpen(false);
    btn.current?.focus();
  };
  /** The next choice that can be picked, one way or the other. */
  const step = (from: number, d: 1 | -1) => {
    for (let i = from + d; i >= 0 && i < options.length; i += d) if (enabled(i)) return i;
    return from;
  };
  // typing a few letters goes to the first choice that starts with them
  const seek = (ch: string) => {
    const now = Date.now();
    typed.current = { text: now - typed.current.at < 700 ? typed.current.text + ch : ch, at: now };
    const q = typed.current.text.toLowerCase();
    const from = open ? active : options.findIndex((o) => o.value === value);
    const order = [...options.keys()].map((k) => (k + Math.max(0, from) + (q.length === 1 ? 1 : 0)) % options.length);
    const i = order.find((k) => enabled(k) && options[k].label.toLowerCase().startsWith(q));
    if (i === undefined) return;
    setActive(i);
    if (!open) setOpen(true);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const first = options.findIndex((o) => !o.disabled);
    const last = options.length - 1 - [...options].reverse().findIndex((o) => !o.disabled);
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) seek(e.key);
      return;
    }
    if (e.key === 'ArrowDown') setActive((x) => step(x, 1));
    else if (e.key === 'ArrowUp') setActive((x) => step(x, -1));
    else if (e.key === 'Home' || e.key === 'PageUp') setActive(first);
    else if (e.key === 'End' || e.key === 'PageDown') setActive(last);
    else if (e.key === 'Enter' || e.key === ' ') pick(active);
    else if (e.key === 'Escape') {
      // closes the list, not the pop-up it's in
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Tab') return setOpen(false);
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) seek(e.key);
    else return;
    e.preventDefault();
  };

  let group: string | undefined;
  return (
    <div className={`${wrapClass} dd ${invalid ? 'is-invalid' : ''} ${open ? 'is-open' : ''} ${picked ? '' : 'is-empty'} ${disabled ? 'is-disabled' : ''}`}>
      {before}
      <button
        ref={btn}
        id={id}
        type="button"
        className={btnClass}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${listId}-list`}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : labelledBy}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        {display ? (
          display(picked)
        ) : (
          <>
            {picked?.tone === 'end' && <Icon name="close" size={14} className="cbx__mark" />}
            <span className="smenu__value">{picked ? picked.label : placeholder}</span>
            {picked?.note && <span className="smenu__note">{picked.note}</span>}
          </>
        )}
      </button>
      {chevron && (
        <span className="control__chevron smenu__chev" aria-hidden="true">
          <Icon name="chevronDown" size={18} />
        </span>
      )}
      {open &&
        at &&
        layer &&
        createPortal(
          <ul
            ref={list}
            id={`${listId}-list`}
            role="listbox"
            aria-label={listLabel ?? ariaLabel}
            aria-labelledby={listLabel ?? ariaLabel ? undefined : labelledBy}
            className={`cbx__list smenu__list ${at.up ? 'is-up' : ''}`}
            style={{ position: at.fixed ? 'fixed' : undefined, top: at.top ?? 'auto', bottom: at.bottom ?? 'auto', left: at.left, width: at.width, maxHeight: at.max }}
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
                  key={`${o.value}-${i}`}
                  id={`${listId}-${i}`}
                  data-index={i}
                  data-value={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  aria-disabled={o.disabled || undefined}
                  className={`cbx__opt ${i === active ? 'is-active' : ''} ${o.disabled ? 'is-disabled' : ''} ${o.tone ? `cbx__opt--${o.tone}` : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => !o.disabled && setActive(i)}
                  onClick={() => pick(i)}
                >
                  {o.tone === 'end' && <Icon name="close" size={14} className="cbx__mark" />}
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

/** A dropdown from a list of choices (the original SelectMenu): the field and its list. */
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
  return <Dropdown id={id} value={value} options={options} onPick={onChange} placeholder={placeholder} listLabel={label} invalid={invalid} describedBy={describedBy} wrapClass="control smenu" />;
}
