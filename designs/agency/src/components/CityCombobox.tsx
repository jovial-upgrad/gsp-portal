import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { citiesFor, type CityOption } from '../data/cities';
import { Icon } from './Icon';
import './combobox.css';

/** Compares names without case or accents, so "parañaque" finds Parañaque and "da nang" finds Da Nang. */
const fold = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

type Opt = CityOption & { own?: boolean };

/**
 * Searchable city picker (ARIA 1.2 combobox, 4 Nov), for the country and state picked above it. Before a state is
 * picked it lists the whole country's cities, each with its state, and picking one fills the state in too. Typing
 * filters the list. A city that isn't listed can still be given: "Use “…”" at the end of the list, Enter, or leaving
 * the field keeps what was typed. Escape goes back to the last city.
 */
export function CityCombobox({
  id,
  country,
  state,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
}: {
  id: string;
  country: string;
  state: string;
  value: string;
  /** The city, and its state when it was picked before the state. */
  onChange: (city: string, state?: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const options = useMemo(() => citiesFor(country, state), [country, state]);

  useEffect(() => setQuery(value), [value]);

  const { hits, own, flat } = useMemo(() => {
    const q = fold(query);
    const showAll = !open || q === '' || q === fold(value);
    const hits = showAll
      ? options
      : options.filter((o) => fold(o.city).includes(q)).sort((a, b) => Number(!fold(a.city).startsWith(q)) - Number(!fold(b.city).startsWith(q)));
    // what was typed, when no listed city is called that
    const typed = query.trim();
    const own: Opt | null = !showAll && typed.length >= 3 && !options.some((o) => fold(o.city) === q) ? { city: typed, state: '', own: true } : null;
    return { hits, own, flat: [...hits, ...(own ? [own] : [])] as Opt[] };
  }, [query, open, value, options]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const commit = (city: string, st?: string) => {
    if (city !== value || (st && st !== state)) onChange(city, st);
    setQuery(city);
    setOpen(false);
  };
  const pick = (o: Opt) => commit(o.city, !state && o.state ? o.state : undefined);

  const openList = () => {
    setOpen(true);
    const i = flat.findIndex((o) => o.city === value);
    setActive(i >= 0 ? i : 0);
  };

  /** What's typed, as a listed city when one is called that (with its spelling), otherwise as it was typed. */
  const commitTyped = () => {
    const t = query.trim();
    const exact = options.find((o) => fold(o.city) === fold(t));
    if (exact) pick(exact);
    else commit(t);
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
      } else if (query.trim() !== value) {
        e.preventDefault();
        commitTyped();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(value);
    }
  };

  const onInputBlur = () => {
    window.setTimeout(() => {
      if (listRef.current?.contains(document.activeElement)) return;
      if (query.trim() !== value) commitTyped();
      setOpen(false);
      onBlur?.();
    }, 120);
  };

  const where = state || country;
  const option = (o: Opt, i: number) => (
    <li
      key={o.own ? '__own' : `${o.state}|${o.city}`}
      id={`${listId}-${i}`}
      data-index={i}
      role="option"
      aria-selected={!o.own && o.city === value}
      className={`cbx__opt ${i === active ? 'is-active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setActive(i)}
      onClick={() => pick(o)}
    >
      {o.own ? (
        <>
          <Icon name="plus" size={16} className="cbx__plus" />
          <span className="cbx__name">Use “{o.city}”</span>
        </>
      ) : (
        <>
          <span className="cbx__name">{o.city}</span>
          {!state && <span className="cbx__dial">{o.state}</span>}
          {o.city === value && <Icon name="check" size={16} className="cbx__tick" />}
        </>
      )}
    </li>
  );

  return (
    <div className={`cbx ${open ? 'is-open' : ''}`}>
      <div className={`control ${invalid ? 'is-invalid' : ''}`}>
        <span className="control__leading">
          <Icon name="pin" size={18} />
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
          onBlur={onInputBlur}
        />
        <button
          type="button"
          className="cbx__toggle"
          tabIndex={-1}
          aria-label={open ? 'Close city list' : 'Open city list'}
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
        <ul ref={listRef} id={`${listId}-list`} role="listbox" aria-label={`Cities in ${where}`} className="cbx__list">
          {hits.length > 0 && (
            <li role="presentation" className="cbx__group">
              Cities in {where}
            </li>
          )}
          {hits.map((o, i) => option(o, i))}
          {hits.length === 0 && !own && (
            <li className="cbx__empty">{options.length ? `No city matches “${query.trim()}”` : `Type the city: there’s no list for ${where} yet.`}</li>
          )}
          {own && (
            <li role="presentation" className="cbx__group">
              {hits.length ? 'Not in the list?' : 'Not in the list'}
            </li>
          )}
          {own && option(own, hits.length)}
        </ul>
      )}
    </div>
  );
}
