import { REGION_COUNTRIES } from '../../admin/data/config';
import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { COUNTRIES } from '../../data/partners';

/** Regions to tick at once: Admin › Sales regions and their countries (Jovial, 1 Nov, HC42). */
export const REGIONS_OF: Record<string, string[]> = REGION_COUNTRIES;

/**
 * Picks countries in a pop-up (29 Oct, 7th round), as the PM prototype's territory picker does: a search, a whole
 * region at once, every country to tick in two columns, and how many are picked, Select all and Clear. Nothing
 * changes until Done.
 */
export function CountryPicker({ open, title, note, selected, onCancel, onDone }: { open: boolean; title: string; note: string; selected: string[]; onCancel: () => void; onDone: (list: string[]) => void }) {
  const all = useMemo(() => COUNTRIES.map((c) => c.name), []);
  const [sel, setSel] = useState<string[]>(selected);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!open) return;
    setSel(selected);
    setQ('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = q.trim().toLowerCase();
  const shown = t ? all.filter((c) => c.toLowerCase().includes(t)) : all;
  const has = new Set(sel);
  const add = (list: string[]) => setSel((x) => [...new Set([...x, ...list])]);
  const drop = (list: string[]) => setSel((x) => x.filter((c) => !list.includes(c)));

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      center
      className="iform icpick"
      title={title}
      sub={note}
      footer={
        <div className="icpick__foot">
          <span className="icpick__n" role="status">
            <span className="num">{sel.length}</span> selected
          </span>
          <button type="button" className="btn btn--link" onClick={() => add(shown)}>
            {t ? `Select these ${shown.length}` : 'Select all'}
          </button>
          <button type="button" className="btn btn--link" onClick={() => setSel([])}>
            Clear
          </button>
          <span className="icpick__acts">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => onDone(all.filter((c) => has.has(c)))}>Done</Button>
          </span>
        </div>
      }
    >
      <label className="icpick__search">
        <Icon name="search" size={18} />
        <span className="vh">Search countries</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries" autoFocus />
      </label>
      <div className="icpick__regions" role="group" aria-label="Select a whole region">
        <span className="icpick__k">Select a whole region:</span>
        {Object.entries(REGIONS_OF).map(([g, list]) => {
          const n = list.filter((c) => has.has(c)).length;
          const whole = n === list.length;
          return (
            <button key={g} type="button" className={`ichip ${n && !whole ? 'is-part' : ''}`} aria-pressed={whole} onClick={() => (whole ? drop(list) : add(list))}>
              {g} <span className="num">{n && !whole ? `${n}/${list.length}` : list.length}</span>
            </button>
          );
        })}
      </div>
      <ul className="icpick__list" aria-label="Countries">
        {shown.map((c) => (
          <li key={c}>
            <label className={`icpick__opt ${has.has(c) ? 'is-on' : ''}`}>
              <input type="checkbox" checked={has.has(c)} onChange={() => (has.has(c) ? drop([c]) : add([c]))} />
              <span>{c}</span>
            </label>
          </li>
        ))}
        {!shown.length && <li className="icpick__none">Nothing matches “{q}”</li>}
      </ul>
    </Sheet>
  );
}
