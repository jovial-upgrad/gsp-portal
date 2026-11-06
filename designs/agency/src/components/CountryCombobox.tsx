import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { COUNTRIES, TOP_MARKETS, type Country } from '../data/partners';
import { Icon } from './Icon';
import './combobox.css';

/**
 * Searchable country picker (ARIA 1.2 combobox). Shows GSP's main markets first, then every country.
 * Typing filters by name or dial code; Enter or a click picks; Escape restores the last pick.
 */
export function CountryCombobox({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  top: first = TOP_MARKETS,
  topLabel = 'Where most partners are',
}: {
  id: string;
  value: string;
  onChange: (name: string) => void;
  invalid?: boolean;
  describedBy?: string;
  /** The countries shown first, and what their group is called: GSP's main markets unless a field asks for others. */
  top?: string[];
  topLabel?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => setQuery(value), [value]);

  const { top, rest, flat } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const showAll = !open || q === '' || q === value.toLowerCase();
    const hit = (c: Country) =>
      showAll || c.name.toLowerCase().includes(q) || c.dial.replace('+', '').startsWith(q.replace('+', ''));
    const rank = (c: Country) => (showAll ? 0 : c.name.toLowerCase().startsWith(q) ? 0 : 1);
    const top = first.map((n) => COUNTRIES.find((c) => c.name === n)!).filter((c) => !!c && hit(c));
    const rest = COUNTRIES.filter((c) => !first.includes(c.name) && hit(c)).sort((a, b) => rank(a) - rank(b));
    return { top, rest, flat: [...top, ...rest] };
  }, [query, open, value, first]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (c: Country) => {
    if (c.name !== value) onChange(c.name);
    setQuery(c.name);
    setOpen(false);
  };

  const openList = () => {
    setOpen(true);
    const i = flat.findIndex((c) => c.name === value);
    setActive(i >= 0 ? i : 0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) return openList();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && flat[active]) {
        e.preventDefault();
        pick(flat[active]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(value);
    }
  };

  const onBlur = () => {
    // Commit an exact typed match; otherwise go back to the last valid pick.
    window.setTimeout(() => {
      if (listRef.current?.contains(document.activeElement)) return;
      const exact = COUNTRIES.find((c) => c.name.toLowerCase() === query.trim().toLowerCase());
      if (exact && exact.name !== value) onChange(exact.name);
      else setQuery(exact ? exact.name : value);
      setOpen(false);
    }, 120);
  };

  const option = (c: Country, i: number) => (
    <li
      key={c.iso}
      id={`${listId}-${i}`}
      data-index={i}
      role="option"
      aria-selected={c.name === value}
      className={`cbx__opt ${i === active ? 'is-active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setActive(i)}
      onClick={() => pick(c)}
    >
      <span className="cbx__name">{c.name}</span>
      <span className="cbx__dial num">{c.dial}</span>
      {c.name === value && <Icon name="check" size={16} className="cbx__tick" />}
    </li>
  );

  return (
    <div className={`cbx ${open ? 'is-open' : ''}`}>
      <div className={`control ${invalid ? 'is-invalid' : ''}`}>
        <span className="control__leading">
          <Icon name="globe" size={18} />
        </span>
        <input
          ref={inputRef}
          id={id}
          className="control__input"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && flat[active] ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          placeholder="Type to search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={(e) => e.target.select()}
          onClick={openList}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
        />
        <button
          type="button"
          className="cbx__toggle"
          tabIndex={-1}
          aria-label={open ? 'Close country list' : 'Open country list'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) setOpen(false);
            else {
              openList();
              inputRef.current?.focus();
            }
          }}
        >
          <Icon name="chevronDown" size={18} />
        </button>
      </div>
      {open && (
        <ul ref={listRef} id={`${listId}-list`} role="listbox" aria-label="Countries" className="cbx__list">
          {flat.length === 0 && <li className="cbx__empty">No country matches “{query}”</li>}
          {top.length > 0 && (
            <li role="presentation" className="cbx__group">
              {topLabel}
            </li>
          )}
          {top.map((c, i) => option(c, i))}
          {rest.length > 0 && (
            <li role="presentation" className="cbx__group">
              All countries
            </li>
          )}
          {rest.map((c, i) => option(c, i + top.length))}
        </ul>
      )}
    </div>
  );
}
