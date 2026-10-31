import { useState } from 'react';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { SelectInput } from '../../../components/forms';
import { TOP_MARKETS, countryByName } from '../../../data/partners';
import { canApplyFrom, type Territory as T, type UniRec } from '../../data/catalogue';
import { stampBy, type RecruitmentPartner } from '../../data/records';
import { Section, downloadCsv, toggle } from '../parts';
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
export function Territory({ u, rps, upd, say, me }: { u: UniRec; rps: RecruitmentPartner[]; upd: UniUpd; say: (m: string) => void; me: string }) {
  const [t, setT] = useState<T>(u.territory);
  const [picking, setPicking] = useState(false);
  const [bc, setBc] = useState('');
  const [bs, setBs] = useState('');
  const [rp, setRp] = useState('');
  const changed = JSON.stringify(t) !== JSON.stringify(u.territory);
  const rpName = (id: string) => rps.find((r) => r.id === id)?.name ?? id;
  const pool = canApplyFrom(t, [...new Set([...TOP_MARKETS, ...t.priority])]);
  const set = (f: Partial<T>) => setT((x) => ({ ...x, ...f }));
  const states = bc ? countryByName(bc)?.states ?? [] : [];

  return (
    <Section
      title="Territory rules"
      id="iu-territory"
      updated={u.stamps.territory}
      action={
        <button
          type="button"
          className="btn btn--secondary btn--sm iadd"
          onClick={() =>
            downloadCsv(`${u.id}-territory.csv`, [
              ['Rule', 'Value'],
              ['Who can apply', t.mode === 'all' ? 'Any country' : `${t.mode === 'only' ? 'Only' : 'All but'}: ${t.countries.join('; ')}`],
              ['Priority markets', t.priority.join('; ')],
              ...t.blocked.map((b) => ['Blocked', `${b.state}, ${b.country}`]),
              ...t.hiddenFrom.map((id) => ['Hidden from', rpName(id)]),
            ])
          }
        >
          <Icon name="download" size={16} /> Export as CSV
        </button>
      }
    >
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
          <h3 className="isteps__k">Priority markets</h3>
          <p className="isteps__v">Of the countries that can apply. Applications from their students get a Priority tag for GSP’s teams, so they’re handled first.</p>
          <div className="itags">
            {pool.map((c) => {
              const on = t.priority.includes(c);
              return (
                <button key={c} type="button" className="ichip istar" aria-pressed={on} onClick={() => set({ priority: toggle(t.priority, c) })}>
                  <Icon name="star" size={16} />
                  {c}
                </button>
              );
            })}
            {!pool.length && <p className="iempty">Pick the countries that can apply first.</p>}
          </div>
        </li>

        <li className="isteps__item">
          <h3 className="isteps__k">Blocked states or cities</h3>
          <p className="isteps__v">For a country that can apply, but not from everywhere in it.</p>
          <div className="ipicker__row">
            <SelectInput id="iut-bc" aria-label="Country" value={bc} placeholder="Country" allowEmpty onChange={(e) => (setBc(e.target.value), setBs(''))}>
              {pool.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
            <SelectInput id="iut-bs" aria-label="State" value={bs} placeholder={bc ? 'Pick a state' : 'Pick the country first'} allowEmpty disabled={!bc} onChange={(e) => setBs(e.target.value)}>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
            <Button
              variant="secondary"
              size="sm"
              disabled={!bc || !bs || t.blocked.some((b) => b.country === bc && b.state === bs)}
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
                  {b.state}, {b.country}
                  <button type="button" aria-label={`Unblock ${b.state}, ${b.country}`} onClick={() => set({ blocked: t.blocked.filter((x) => x !== b) })}>
                    <Icon name="close" size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </li>

        <li className="isteps__item">
          <h3 className="isteps__k">Recruitment partners that can’t see it</h3>
          <p className="isteps__v">A restricted recruitment partner never sees this university, in search or anywhere else.</p>
          <div className="ipicker__row">
            <SelectInput id="iut-rp" aria-label="Recruitment partner" value={rp} placeholder="Pick a recruitment partner" allowEmpty onChange={(e) => setRp(e.target.value)}>
              {rps
                .filter((r) => !t.hiddenFrom.includes(r.id))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.city})
                  </option>
                ))}
            </SelectInput>
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

      {changed && (
        <div className="isave" role="region" aria-label="Unsaved territory rules">
          <p className="isave__t">Course search in this role follows these once they’re saved.</p>
          <Button variant="secondary" size="sm" onClick={() => setT(u.territory)}>
            Discard
          </Button>
          <Button
            size="sm"
            disabled={t.mode === 'only' && !t.countries.length}
            onClick={() => {
              upd((x) => ({ ...x, territory: t, stamps: { ...x.stamps, territory: stampBy(me) } }));
              say('Territory rules saved.');
            }}
          >
            Save territory rules
          </Button>
        </div>
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
