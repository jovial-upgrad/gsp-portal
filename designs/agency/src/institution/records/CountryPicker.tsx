import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { COUNTRIES } from '../../data/partners';

/** Regions to tick at once, as in the PM prototype's territory picker, named as the country list names them. */
export const REGIONS_OF: Record<string, string[]> = {
  'South Asia': ['India', 'Nepal', 'Sri Lanka', 'Bangladesh', 'Pakistan', 'Bhutan', 'Maldives'],
  'South-East Asia': ['Vietnam', 'Indonesia', 'Philippines', 'Myanmar', 'Malaysia', 'Thailand', 'Cambodia', 'Laos'],
  'East Asia': ['China', 'Hong Kong S.A.R.', 'Taiwan', 'South Korea', 'Japan', 'Mongolia'],
  'Middle East': ['United Arab Emirates', 'Saudi Arabia', 'Oman', 'Qatar', 'Kuwait', 'Bahrain', 'Jordan', 'Iran', 'Iraq'],
  Africa: ['Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon', 'Cape Verde', 'Central African Republic', 'Chad', 'Comoros', 'Congo', 'Democratic Republic of the Congo', 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Swaziland', 'Ethiopia', 'Gabon', 'The Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', "Cote D'Ivoire (Ivory Coast)", 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'],
  'Central Asia': ['Uzbekistan', 'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan'],
  'Latin America': ['Brazil', 'Colombia', 'Mexico', 'Peru', 'Chile', 'Argentina', 'Ecuador'],
};

/**
 * Picks countries in a pop-up (29 Oct, 7th round), as the PM prototype's territory picker does: a search, a whole
 * region at once, every country to tick in two columns, and how many are picked, Select all and Clear. Nothing
 * changes until Done.
 */
export function CountryPicker({ open, title, note, selected, onCancel, onDone }: { open: boolean; title: string; note?: string; selected: string[]; onCancel: () => void; onDone: (list: string[]) => void }) {
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
