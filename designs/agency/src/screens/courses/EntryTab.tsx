import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { SelectMenu } from '../../components/SelectMenu';
import type { Course } from '../../data/courses';
import { ALL_COUNTRIES, ENTRY_COUNTRIES, entryFor, flagOf } from '../../data/entry';
import { Tile } from './parts';

/**
 * Eligibility and documents, in every role's course dialog. Entry differs by where the student studied, so it opens
 * with one dropdown: **All countries** first, then the countries GSP recruits from most, each with its flag; the RP's
 * own country (India, for now) by default. 3 Nov (Nesil): each country is **one card** with what its students need
 * (Grade 10 and Grade 12 where the country counts them, the highest degree for a postgraduate course, English, work
 * experience) and the documents to collect. All countries lists the cards closed, each opened with its arrow; one
 * country shows its card open, with no arrow.
 */
export function EntryTab({ c, country, onCountry }: { c: Course; country: string; onCountry: (c: string) => void }) {
  const all = country === ALL_COUNTRIES;
  const [open, setOpen] = useState<string[]>([]);
  return (
    <div className="cm-stack">
      <div className="cm-cpick">
        <label htmlFor="cm-cpick" className="cm-cpick__k">
          Requirements for students from
        </label>
        <div className="cm-cpick__menu">
          <SelectMenu
            id="cm-cpick"
            value={country}
            label="Countries"
            options={[{ value: ALL_COUNTRIES, label: 'All countries' }, ...ENTRY_COUNTRIES.map((n) => ({ value: n, label: `${flagOf(n)}  ${n}` }))]}
            onChange={onCountry}
          />
        </div>
      </div>
      {all ? (
        <>
          <div className="ecards__bar">
            <p className="ecards__n">
              {ENTRY_COUNTRIES.length} countries. Open one to see what its students need and the documents to collect.
            </p>
            <button type="button" className="btn btn--link" onClick={() => setOpen((o) => (o.length === ENTRY_COUNTRIES.length ? [] : [...ENTRY_COUNTRIES]))}>
              {open.length === ENTRY_COUNTRIES.length ? 'Close all' : 'Open all'}
            </button>
          </div>
          <ul className="ecards">
            {ENTRY_COUNTRIES.map((n) => (
              <li key={n}>
                <CountryCard c={c} country={n} open={open.includes(n)} onToggle={() => setOpen((o) => (o.includes(n) ? o.filter((x) => x !== n) : [...o, n]))} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <CountryCard c={c} country={country} open />
      )}
      <Pathway c={c} />
    </div>
  );
}

const isPg = (c: Course) => c.level === 'Master’s degree' || c.level === 'Postgraduate diploma' || c.level === 'PhD or research';
const needClass = (need: string) => `cs-need cs-need--${need === 'Required' ? 'req' : need === 'Optional' ? 'opt' : 'later'}`;

function Pathway({ c }: { c: Course }) {
  if (!c.pathway) return null;
  return (
    <p className="cnote">
      <strong>Doesn’t meet entry yet?</strong> The university runs a pathway: {isPg(c) ? 'a graduate certificate' : 'a foundation year or diploma'} or English classes first, then straight into this course.
    </p>
  );
}

function DocList({ docs }: { docs: Course['docs'] }) {
  return (
    <ul className="cs-docs">
      {docs.map(([name, need, when]) => (
        <li key={name} className="cs-doc">
          <span className="cs-doc__icon" aria-hidden="true">
            <Icon name="doc" size={16} />
          </span>
          <span className="cs-doc__name">{name}</span>
          <span className="cs-doc__when">{when}</span>
          <span className={needClass(need)}>{need}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One country's card: its flag and name with the main figures in one line, then what its students need as tiles, a
 * note where the country has one, how the English test can wait, and the documents to collect. With `onToggle` its
 * header opens and closes it (All countries); without, it's always open.
 */
function CountryCard({ c, country, open, onToggle }: { c: Course; country: string; open: boolean; onToggle?: () => void }) {
  const r = entryFor(c, country);
  const req = r.docs.filter(([, need]) => need === 'Required').length;
  const id = `ec-${country.replace(/\W+/g, '-').toLowerCase()}`;
  const head = (
    <>
      <span className="ecard__flag" aria-hidden="true">
        {flagOf(country)}
      </span>
      <span className="ecard__t">
        <span className="ecard__name">Students from {country}</span>
        <span className="ecard__sum">{r.reqs.filter(([k]) => !['Grade 10', 'Backlogs', 'Work experience'].includes(k)).map(([k, v]) => `${k} ${v}`).join(' · ')}</span>
      </span>
    </>
  );
  return (
    <section className={`ecard ${open ? 'is-open' : ''}`} aria-labelledby={`${id}-h`}>
      {onToggle ? (
        <h3 className="ecard__h" id={`${id}-h`}>
          <button type="button" className="ecard__head" aria-expanded={open} aria-controls={id} onClick={onToggle}>
            {head}
            <Icon name="chevronDown" size={20} className="ecard__chev" />
          </button>
        </h3>
      ) : (
        <h3 className="ecard__h ecard__head is-static" id={`${id}-h`}>
          {head}
        </h3>
      )}
      {open && (
        <div className="ecard__body" id={id}>
          <p className="ecard__k">What they need</p>
          <dl className="cm-tiles ecard__reqs">
            {r.reqs.map(([k, v, sub]) => (
              <Tile key={k} k={k} v={v} sub={sub} />
            ))}
          </dl>
          {r.note && <p className="cnote">{r.note}</p>}
          {c.englishFlex && <p className="cnote">The English test can wait: a conditional offer is possible{r.waiver ? `, or ${r.waiver}` : ''}.</p>}
          <p className="ecard__k">
            Documents to collect <span className="ecard__kn">· {req} required</span>
          </p>
          <DocList docs={r.docs} />
        </div>
      )}
    </section>
  );
}
