import { useState } from 'react';
import { EditOnly } from '../../../proto/viewOnly';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { SelectInput } from '../../../components/forms';
import { COUNTRIES, TOP_MARKETS, countryByName } from '../../../data/partners';
import { canApplyFrom, type Territory as T, type UniRec } from '../../data/catalogue';
import { type RecruitmentPartner } from '../../data/records';
import { Facts, Section, downloadCsv, useAsk } from '../parts';
import { CountryPicker } from '../CountryPicker';
import { MultiPick } from '../MultiPick';
import type { UniUpd } from '../UniversityPage';

const MODES: { key: T['mode']; label: string }[] = [
  { key: 'all', label: 'Any country' },
  { key: 'except', label: 'All but some' },
  { key: 'only', label: 'Only some' },
];
/** Every country, as the country list names them, the main markets first. */
const EVERY = [...TOP_MARKETS, ...COUNTRIES.map((c) => c.name).filter((n) => !TOP_MARKETS.includes(n))];

/**
 * Territory rules (29 Oct, 2nd round, after the PM prototype): which countries can apply, which are priority markets
 * (their applications get a Priority tag for GSP's teams), states or cities blocked within a country, and recruitment
 * partners that never see the university. Course search in this role follows them. Changed here, then saved.
 * 29 Oct (7th round): the countries for All but some and Only some are ticked in a pop-up, as in the PM prototype.
 * 29 Oct (8th round): no "In short" summary. 3 Nov: it shows what's saved, read-only, with Edit territory; only then
 * can it be changed, and Save or Cancel closes it. 4 Nov: priority countries are picked from every country that can
 * apply (any country, for Any country), the recruitment partners it's hidden from from a list of several, and
 * taking out something saved asks first; no lines under the titles.
 */
export function Territory({ u, rps, upd, say }: { u: UniRec; rps: RecruitmentPartner[]; upd: UniUpd; say: (m: string) => void }) {
  const [t, setT] = useState<T>(u.territory);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [bc, setBc] = useState('');
  const [bs, setBs] = useState('');
  const { ask, dialog } = useAsk();
  const changed = JSON.stringify(t) !== JSON.stringify(u.territory);
  const rpName = (id: string) => rps.find((r) => r.id === id)?.name ?? id;
  const rpLabel = (id: string) => {
    const r = rps.find((x) => x.id === id);
    return r ? `${r.name} (${r.city})` : id;
  };
  // the countries that can apply: every country, less those left out, or only those picked
  const pool = canApplyFrom(t, EVERY);
  const blockable = pool.filter((c) => (countryByName(c)?.states.length ?? 0) > 0);
  const set = (f: Partial<T>) => setT((x) => ({ ...x, ...f }));
  const states = bc ? countryByName(bc)?.states ?? [] : [];
  const cancel = () => {
    setT(u.territory);
    setBc('');
    setBs('');
    setEditing(false);
  };
  const saved = u.territory;
  const listOr = (l: string[], none: string) => (l.length ? l.join(', ') : none);
  /** Takes something out; when it was saved, asks first (4 Nov). */
  const drop = (was: boolean, what: string, title: string, run: () => void, confirm = 'Remove') => (was ? ask(title, confirm, <p>{what} Nothing changes until you save.</p>, run) : run());

  return (
    <Section
      title="Territory rules"
      id="iu-territory"
      updated={u.stamps.territory}
      action={
        <div className="irsec__acts">
          {!editing && (
            <EditOnly>
              <Button variant="secondary" size="sm" iconLeft={<Icon name="edit" size={16} />} onClick={() => (setT(u.territory), setEditing(true))}>
                Edit territory
              </Button>
            </EditOnly>
          )}
          <EditOnly>
            <button
              type="button"
              className="btn btn--secondary btn--sm iadd"
              onClick={() =>
                downloadCsv(`${u.id}-territory.csv`, [
                  ['Rule', 'Value'],
                  ['Who can apply', saved.mode === 'all' ? 'Any country' : `${saved.mode === 'only' ? 'Only' : 'All but'}: ${saved.countries.join('; ')}`],
                  ['Priority countries', saved.priority.join('; ')],
                  ...saved.blocked.map((b) => ['Blocked', `${b.state}, ${b.country}`]),
                  ...saved.hiddenFrom.map((id) => ['Hidden from', rpName(id)]),
                ])
              }
            >
              <Icon name="download" size={16} /> Export as CSV
            </button>
          </EditOnly>
        </div>
      }
    >
      {!editing ? (
        <Facts
          items={[
            ['Countries', saved.mode === 'all' ? 'All countries' : saved.mode === 'only' ? `Only ${listOr(saved.countries, 'none picked')}` : `All but ${listOr(saved.countries, 'none left out')}`],
            ['Priority countries', listOr(saved.priority, 'None')],
            ['Blocked country and state pairs', listOr(saved.blocked.map((b) => `${b.state}, ${b.country}`), 'None')],
            ['RPs it’s hidden from', listOr(saved.hiddenFrom.map(rpName), 'Nobody')],
          ]}
        />
      ) : (
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
                    <EditOnly>
                      <button
                        type="button"
                        aria-label={`Remove ${c}`}
                        onClick={() =>
                          drop(saved.mode === t.mode && saved.countries.includes(c), t.mode === 'only' ? `Students from ${c} can’t apply.` : `Students from ${c} can apply again.`, `Remove ${c}?`, () =>
                            setT((x) => ({ ...x, countries: x.countries.filter((y) => y !== c), priority: x.mode === 'only' ? x.priority.filter((y) => y !== c) : x.priority })),
                          )
                        }
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </EditOnly>
                  </span>
                ))}
              </div>
              <EditOnly>
                <Button variant="secondary" size="sm" iconLeft={<Icon name={t.countries.length ? 'edit' : 'plus'} size={16} />} onClick={() => setPicking(true)}>
                  {t.countries.length ? 'Edit countries' : 'Choose countries'}
                </Button>
              </EditOnly>
            </div>
          )}
        </li>

        <li className="isteps__item">
          <h3 className="isteps__k" id="iut-pr-k">
            Priority countries
          </h3>
          {pool.length ? (
            <div className="ipicker">
              <div className="ipicker__pick">
                <MultiPick id="iut-pr" label="Priority countries" value={t.priority} options={pool} onChange={(priority) => set({ priority: pool.filter((c) => priority.includes(c)) })} empty="Pick countries" search />
              </div>
              {t.priority.length > 0 && (
                <div className="itags">
                  {t.priority.map((c) => (
                    <span key={c} className="itag itag--x istar-tag">
                      <Icon name="star" size={14} />
                      {c}
                      <EditOnly>
                        <button type="button" aria-label={`Remove ${c} from priority countries`} onClick={() => drop(saved.priority.includes(c), `Applications from ${c} no longer get a Priority tag.`, `Remove ${c} from priority countries?`, () => setT((x) => ({ ...x, priority: x.priority.filter((y) => y !== c) })))}>
                          <Icon name="close" size={14} />
                        </button>
                      </EditOnly>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="iempty">Pick the countries that can apply first.</p>
          )}
        </li>

        <li className="isteps__item">
          <h3 className="isteps__k">Blocked states or cities</h3>
          <div className="ipicker__row">
            <SelectInput id="iut-bc" aria-label="Country" value={bc} placeholder="Country" allowEmpty onChange={(e) => (setBc(e.target.value), setBs(''))}>
              {blockable.map((c) => (
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
            <EditOnly>
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
            </EditOnly>
          </div>
          {t.blocked.length > 0 && (
            <div className="itags">
              {t.blocked.map((b) => (
                <span key={`${b.country}-${b.state}`} className="itag itag--x">
                  {b.state}, {b.country}
                  <EditOnly>
                    <button
                      type="button"
                      aria-label={`Unblock ${b.state}, ${b.country}`}
                      onClick={() =>
                        drop(saved.blocked.some((x) => x.country === b.country && x.state === b.state), `Students from ${b.state} can apply again.`, `Unblock ${b.state}, ${b.country}?`, () =>
                          setT((x) => ({ ...x, blocked: x.blocked.filter((y) => !(y.country === b.country && y.state === b.state)) })),
                        'Unblock',
                        )
                      }
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </EditOnly>
                </span>
              ))}
            </div>
          )}
        </li>

        <li className="isteps__item">
          <h3 className="isteps__k">Recruitment partners that can’t see it</h3>
          <div className="ipicker">
            <div className="ipicker__pick">
              <MultiPick id="iut-rp" label="Recruitment partners" value={t.hiddenFrom.map(rpLabel)} options={rps.map((r) => rpLabel(r.id))} onChange={(names) => set({ hiddenFrom: rps.filter((r) => names.includes(rpLabel(r.id))).map((r) => r.id) })} empty="Pick recruitment partners" search />
            </div>
            {t.hiddenFrom.length > 0 && (
              <div className="itags">
                {t.hiddenFrom.map((id) => (
                  <span key={id} className="itag itag--x">
                    {rpName(id)}
                    <EditOnly>
                      <button type="button" aria-label={`Let ${rpName(id)} see it again`} onClick={() => drop(saved.hiddenFrom.includes(id), `${rpName(id)} sees this university again.`, `Let ${rpName(id)} see it again?`, () => setT((x) => ({ ...x, hiddenFrom: x.hiddenFrom.filter((y) => y !== id) })), 'Let them see it')}>
                        <Icon name="close" size={14} />
                      </button>
                    </EditOnly>
                  </span>
                ))}
              </div>
            )}
          </div>
        </li>
      </ol>
      )}
      {dialog}

      {editing && (
        <div className="isave" role="region" aria-label="Editing territory rules">
          <p className="isave__t">{t.mode === 'only' && !t.countries.length ? 'Pick the countries that can apply, then save.' : changed ? 'Not saved yet.' : 'Nothing changed yet.'}</p>
          <Button variant="secondary" size="sm" onClick={cancel}>
            Cancel
          </Button>
          <EditOnly>
            <Button
              size="sm"
              disabled={!changed || (t.mode === 'only' && !t.countries.length)}
              onClick={() => {
                upd((x) => ({ ...x, territory: t }), territoryChanges(saved, t, rpName));
                setEditing(false);
                say('Territory rules saved.');
              }}
            >
              Save
            </Button>
          </EditOnly>
        </div>
      )}
      <CountryPicker
        open={picking}
        title={t.mode === 'except' ? 'Countries to leave out' : 'Countries that can apply'}
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

/** What changed in the territory, for the Logs tab. */
function territoryChanges(a: T, b: T, rpName: (id: string) => string) {
  const out: string[] = [];
  const who = (t: T) => (t.mode === 'all' ? 'any country' : `${t.mode === 'only' ? 'only' : 'all but'} ${t.countries.join(', ') || 'none'}`);
  if (a.mode !== b.mode || a.countries.join() !== b.countries.join()) out.push(`Who can apply: ${who(a)} → ${who(b)}`);
  const diff = (k: string, x: string[], y: string[]) => {
    const add = y.filter((v) => !x.includes(v));
    const off = x.filter((v) => !y.includes(v));
    if (add.length) out.push(`${k}: added ${add.join(', ')}`);
    if (off.length) out.push(`${k}: removed ${off.join(', ')}`);
  };
  diff('Priority countries', a.priority, b.priority);
  diff('Blocked', a.blocked.map((x) => `${x.state}, ${x.country}`), b.blocked.map((x) => `${x.state}, ${x.country}`));
  diff('Hidden from', a.hiddenFrom.map(rpName), b.hiddenFrom.map(rpName));
  return out.join('; ') || 'Saved with no changes';
}
