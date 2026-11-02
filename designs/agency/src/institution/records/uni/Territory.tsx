import { useState } from 'react';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { COUNTRIES, countryByName } from '../../../data/partners';
import { type Territory as T, type UniRec } from '../../data/catalogue';
import { stampBy, type RecruitmentPartner } from '../../data/records';
import { ErrorText, Facts, Pick, Section, downloadCsv } from '../parts';
import { MultiPick } from '../MultiPick';
import { SearchPick } from '../SearchPick';
import { CountryPicker } from '../CountryPicker';
import type { UniUpd } from '../UniversityPage';

const MODES: { key: T['mode']; label: string; note: string }[] = [
  { key: 'all', label: 'Any country', note: 'Students from anywhere can apply' },
  { key: 'except', label: 'All but some', note: 'Leave a few countries out' },
  { key: 'only', label: 'Only some', note: 'Pick the countries that can apply' },
];

/**
 * Territory rules (29 Oct, 2nd round, after the PM prototype): which countries can apply, which are priority markets
 * (their applications get a Priority tag for GSP's teams), states or cities blocked within a country, and recruitment
 * partners that never see the university. Course search in this role follows them. Changed here, then saved.
 * 29 Oct (7th round): the countries for All but some and Only some are ticked in a pop-up, as in the PM prototype.
 * 29 Oct (8th round): no "In short" summary.
 */
export function Territory({ u, rps, upd, say, me, edit = true }: { u: UniRec; rps: RecruitmentPartner[]; upd: UniUpd; say: (m: string) => void; me: string; edit?: boolean }) {
  const [t, setT] = useState<T>(u.territory);
  // slice 2 PRD: read-only, then Edit territory (Cancel or Save), saved on its own
  const [editing, setEditing] = useState(false);
  const [tried, setTried] = useState(false);
  const [picking, setPicking] = useState(false);
  const [bc, setBc] = useState('');
  const [bs, setBs] = useState('');
  const [rp, setRp] = useState('');
  const changed = JSON.stringify(t) !== JSON.stringify(u.territory);
  const rpName = (id: string) => rps.find((r) => r.id === id)?.name ?? id;
  const allCountries = COUNTRIES.map((c) => c.name);
  const modeErr = t.mode !== 'all' && !t.countries.length ? 'Pick at least one country.' : null;
  const pairTaken = t.blocked.some((b) => b.country === bc && (b.state || '') === (bs || ''));
  const set = (f: Partial<T>) => setT((x) => ({ ...x, ...f }));
  const states = bc ? countryByName(bc)?.states ?? [] : [];

  return (
    <Section
      title="Territory rules"
      id="iu-territory"
      updated={u.stamps.territory}
      action={
        <span className="irowacts">
        {edit && !editing && (
          <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => (setT(u.territory), setEditing(true))}>
            Edit territory
          </Button>
        )}
        <button
          type="button"
          className="btn btn--secondary btn--sm iadd"
          onClick={() =>
            downloadCsv(`${u.id}-territory.csv`, [
              ['Rule', 'Value'],
              ['Who can apply', t.mode === 'all' ? 'Any country' : `${t.mode === 'only' ? 'Only' : 'All but'}: ${t.countries.join('; ')}`],
              ['Priority markets', t.priority.join('; ')],
              ...t.blocked.map((b) => ['Blocked', b.state ? `${b.state}, ${b.country}` : `${b.country} (whole country)`]),
              ...t.hiddenFrom.map((id) => ['Hidden from', rpName(id)]),
            ])
          }
        >
          <Icon name="download" size={16} /> Export as CSV
        </button>
        </span>
      }
    >
      {!editing ? (
        <Facts
          items={[
            ['Countries', t.mode === 'all' ? 'All countries' : `${t.mode === 'only' ? 'Only' : 'All except'}: ${u.territory.countries.join(', ')}`],
            ['Priority countries', u.territory.priority.length ? u.territory.priority.join(', ') : 'None'],
            ['Blocked country and state pairs', u.territory.blocked.length ? u.territory.blocked.map((b) => (b.state ? `${b.state}, ${b.country}` : `${b.country} (whole country)`)).join('; ') : 'None'],
            ['RPs it’s hidden from', u.territory.hiddenFrom.length ? u.territory.hiddenFrom.map(rpName).join(', ') : 'Nobody'],
          ]}
        />
      ) : (
      <>
      <ol className="isteps">
        <li className="isteps__item">
          <h3 className="isteps__k">Which countries can apply?</h3>
          <div className="itypes itypes--3" role="radiogroup" aria-label="Which countries can apply">
            {MODES.map((m) => (
              <label key={m.key} className={`itype ${t.mode === m.key ? 'is-on' : ''}`}>
                <input
                  type="radio"
                  name={`iut-mode-${u.id}`}
                  className="vh"
                  checked={t.mode === m.key}
                  onChange={() => {
                    // the list means the opposite in the other mode, so it starts again
                    set({ mode: m.key, countries: [] });
                    if (m.key !== 'all') setPicking(true);
                  }}
                />
                <span className="itype__k">{m.label}</span>
                <span className="itype__v">{m.note}</span>
              </label>
            ))}
          </div>
          {tried && modeErr && <ErrorText>{modeErr}</ErrorText>}
          {t.mode !== 'all' && (
            <div className="ipicker">
              <p className="ipicker__k">{t.mode === 'only' ? `${t.countries.length} ${t.countries.length === 1 ? 'country can' : 'countries can'} apply` : `${t.countries.length} left out`}</p>
              <div className="itags">
                {t.countries.map((c) => (
                  <span key={c} className="itag itag--x">
                    {c}
                    <button type="button" aria-label={`Remove ${c}`} onClick={() => set({ countries: t.countries.filter((x) => x !== c), priority: t.priority.filter((x) => x !== c) })}>
                      <Icon name="close" size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <Button variant="secondary" size="sm" iconLeft={<Icon name={t.countries.length ? 'edit' : 'plus'} size={16} />} onClick={() => setPicking(true)}>
                {t.countries.length ? 'Edit countries' : 'Choose countries'}
              </Button>
            </div>
          )}
        </li>

        <li className="isteps__item">
          <h3 className="isteps__k">Priority countries</h3>
          <p className="isteps__v">Any countries. An application whose student’s nationality is one of them gets a Priority chip, for GSP only. It doesn’t change what is shown.</p>
          <MultiPick id="iut-pri" label="Priority countries" value={t.priority} options={allCountries} onChange={(priority) => set({ priority })} empty="None" search />
        </li>

        <li className="isteps__item">
          <h3 className="isteps__k">Blocked country and state pairs</h3>
          <p className="isteps__v">A country, and optionally one of its states. A blocked country with no state blocks the whole country.</p>
          <div className="ipicker__row">
            <Pick id="iut-bc" label="Country" value={bc} placeholder="Pick a country" options={allCountries} onChange={(v) => (setBc(v), setBs(''))} />
            <Pick id="iut-bs" label="State" value={bs} all={bc ? 'Whole country' : 'Pick the country first'} options={states} onChange={setBs} />
            <Button
              variant="secondary"
              size="sm"
              disabled={!bc || pairTaken}
              title={pairTaken ? 'Already blocked.' : undefined}
              onClick={() => {
                set({ blocked: [...t.blocked, { country: bc, state: bs }] });
                setBs('');
              }}
            >
              Block
            </Button>
          </div>
          {t.blocked.length > 0 && (
            <div className="itags">
              {t.blocked.map((b) => (
                <span key={`${b.country}-${b.state}`} className="itag itag--x">
                  {b.state ? `${b.state}, ${b.country}` : `${b.country} (whole country)`}
                  <button type="button" aria-label={`Unblock ${b.state || 'all of'} ${b.country}`} onClick={() => set({ blocked: t.blocked.filter((x) => x !== b) })}>
                    <Icon name="close" size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </li>

        <li className="isteps__item">
          <h3 className="isteps__k">RPs it’s hidden from</h3>
          <p className="isteps__v">They never see the university’s courses. Search by RP name or code.</p>
          <div className="ipicker__row">
            <SearchPick id="iut-rp" label="Recruitment partners" placeholder="RP name or code" value={rp} options={rps.filter((r) => !t.hiddenFrom.includes(r.id)).map((r) => ({ value: r.id, label: r.name, note: r.code }))} onChange={setRp} />
            <Button
              variant="secondary"
              size="sm"
              disabled={!rp}
              onClick={() => {
                set({ hiddenFrom: [...t.hiddenFrom, rp] });
                setRp('');
              }}
            >
              Restrict
            </Button>
          </div>
          {t.hiddenFrom.length > 0 && (
            <div className="itags">
              {t.hiddenFrom.map((id) => (
                <span key={id} className="itag itag--x">
                  {rpName(id)}
                  <button type="button" aria-label={`Let ${rpName(id)} see it again`} onClick={() => set({ hiddenFrom: t.hiddenFrom.filter((x) => x !== id) })}>
                    <Icon name="close" size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </li>
      </ol>

        <div className="isave" role="region" aria-label="Territory">
          <p className="isave__t">{tried && modeErr ? modeErr : changed ? 'Not saved yet.' : 'Nothing changed yet.'}</p>
          <Button variant="secondary" size="sm" onClick={() => (setT(u.territory), setTried(false), setEditing(false))}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!changed}
            onClick={() => {
              setTried(true);
              if (modeErr) return;
              upd((x) => ({ ...x, territory: t, stamps: { ...x.stamps, territory: stampBy(me) } }));
              setEditing(false);
              setTried(false);
              say('Territory saved.');
            }}
          >
            Save
          </Button>
        </div>
      </>
      )}
      <CountryPicker
        open={picking}
        title={t.mode === 'except' ? 'Countries to leave out' : 'Countries that can apply'}
        note={t.mode === 'except' ? 'Tick the countries this university doesn’t take. Use a region to tick all its countries at once.' : 'Tick every country whose students can apply. Use a region to tick all its countries at once.'}
        selected={t.countries}
        onCancel={() => setPicking(false)}
        onDone={(list) => {
          set({ countries: list, priority: t.mode === 'only' ? t.priority.filter((c) => list.includes(c)) : t.priority.filter((c) => !list.includes(c)) });
          setPicking(false);
        }}
      />
    </Section>
  );
}
