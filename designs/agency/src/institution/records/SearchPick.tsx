import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import '../../components/combobox.css';

export type PickOption = { value: string; label: string; note?: string };

/**
 * A searchable picker (ARIA 1.2 combobox), as the country picker works, for any list: typing filters by name or its
 * note; Enter or a click picks; Escape goes back to what was picked. Used for the institution partner a university
 * sits under (29 Oct, 4th round: "I should be able to search and find").
 */
export function SearchPick({ id, value, options, onChange, invalid, describedBy, label, placeholder = 'Type to search' }: { id: string; value: string; options: PickOption[]; onChange: (v: string) => void; invalid?: boolean; describedBy?: string; label: string; placeholder?: string }) {
  const listId = useId();
  const picked = options.find((o) => o.value === value);
  const [query, setQuery] = useState(picked?.label ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => setQuery(picked?.label ?? ''), [picked?.label]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!open || !q || q === picked?.label.toLowerCase()) return options;
    return options.filter((o) => `${o.label} ${o.note ?? ''}`.toLowerCase().includes(q)).sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)));
  }, [query, open, options, picked?.label]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

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
    <div className={`cbx ${open ? 'is-open' : ''}`}>
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
          onClick={openList}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!open) return openList();
              setActive((a) => Math.min(a + 1, shown.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              if (open && shown[active]) {
                e.preventDefault();
                pick(shown[active]);
              }
            } else if (e.key === 'Escape' && open) {
              e.stopPropagation();
              setOpen(false);
              setQuery(picked?.label ?? '');
            }
          }}
          onBlur={() =>
            window.setTimeout(() => {
              if (list.current?.contains(document.activeElement)) return;
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
              openList();
              input.current?.focus();
            }
          }}
        >
          <Icon name="chevronDown" size={18} />
        </button>
      </div>
      {open && (
        <ul ref={list} id={`${listId}-list`} role="listbox" aria-label={label} className="cbx__list">
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
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
            >
              <span className="cbx__name">{o.label}</span>
              {o.note && <span className="cbx__dial">{o.note}</span>}
              {o.value === value && <Icon name="check" size={16} className="cbx__tick" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
