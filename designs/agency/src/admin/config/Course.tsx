import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { SelectMenu } from '../../components/SelectMenu';
import { Sheet } from '../../components/Sheet';
import { Field, TextInput } from '../../components/forms';
import { FLAG, type Destination } from '../../data/courses';
import { COUNTRIES, countryByName } from '../../data/partners';
import { AssistMark, Thinking } from '../../screens/applications/parts';
import { PageHead } from '../../institution/records/parts';
import { SearchPick } from '../../institution/records/SearchPick';
import { weekOf, type CityCost, type FxRow, type FxWeek, type Living } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { EditActions, History, Panel, useAsk, when } from './parts';

const num = (v: string) => Number(v.replace(/[^\d.]/g, ''));
const ease = [0.2, 0.8, 0.2, 1] as const;
const weekText = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const rupees = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const aud = (v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 4 });
const FLAG_OF: Record<string, string> = { AUD: '🇦🇺', GBP: '🇬🇧', CAD: '🇨🇦', NZD: '🇳🇿', EUR: '🇪🇺', USD: '🇺🇸' };
/** GSP Assist's read of this week's reference rates: a small move on each (in the product, from a rates feed). */
const fetched = (w: FxWeek): FxWeek => ({
  ...w,
  inrPerAud: Math.round(w.inrPerAud * 1.0042 * 100) / 100,
  rows: w.rows.map((r, i) => (r.code === 'AUD' ? r : { ...r, aud: Math.round(r.aud * (1 + (i % 2 ? 0.0031 : -0.0024)) * 10_000) / 10_000 })),
});

/**
 * Currency Exchange (Nesil, 3 Nov, after the reference screens): one unit of each currency in Australian dollars,
 * Finance's base, and in rupees from the AUD row. Finance prices each commission line at the rate of the week it's
 * paid, so every week keeps its own rates: pick the week, and this week's can be fetched by GSP Assist or edited, then
 * saved. Course search works out its budgets in lakhs from the rupee column.
 */
export function Currency({ cfg, change, say, me }: ConfigProps) {
  const reduce = useReducedMotion();
  const thisWeek = weekOf(Date.now());
  const [week, setWeek] = useState(cfg.fx[0]?.week ?? thisWeek);
  const [draft, setDraft] = useState<FxWeek | null>(null);
  const [ai, setAi] = useState<'idle' | 'busy' | 'ready'>('idle');
  const t = useRef<number>();
  useEffect(() => () => window.clearTimeout(t.current), []);
  const i = cfg.fx.findIndex((w) => w.week === week);
  const saved = cfg.fx[i] ?? cfg.fx[0];
  const prev = cfg.fx[i + 1];
  const w = draft ?? saved;
  const isNow = saved.week === thisWeek;
  const proposal = ai === 'ready' ? fetched(saved) : null;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const pick = (v: string) => (draft ? say('Save or cancel this week’s changes first.') : (setWeek(v), setAi('idle')));
  const setRow = (code: string, v: number) => setDraft((d) => ({ ...d!, rows: d!.rows.map((r) => (r.code === code ? { ...r, aud: v } : r)) }));
  const save = () => {
    const d = draft!;
    const moved = d.rows.filter((r) => r.aud !== saved.rows.find((x) => x.code === r.code)?.aud).map((r) => `${r.code} ${aud(saved.rows.find((x) => x.code === r.code)!.aud)} → ${aud(r.aud)} AUD`);
    if (d.inrPerAud !== saved.inrPerAud) moved.unshift(`AUD ${rupees(saved.inrPerAud)} → ${rupees(d.inrPerAud)}`);
    const now = Date.now();
    const next: FxWeek = {
      ...d,
      rows: d.rows.map((r) => {
        const was = saved.rows.find((x) => x.code === r.code)!;
        const changed = r.aud !== was.aud || (r.code === 'AUD' && d.inrPerAud !== saved.inrPerAud);
        return changed ? { ...r, updated: now, by: me } : r;
      }),
    };
    change('Currency exchange', `Week of ${weekText(d.week)}: ${moved.join('; ')}`, (c) => ({ ...c, fx: c.fx.map((x) => (x.week === d.week ? next : x)) }));
    say(`This week’s rates saved: ${moved.length} ${moved.length === 1 ? 'change' : 'changes'}.`);
    setDraft(null);
  };
  const last = [...saved.rows].sort((a, b) => b.updated - a.updated)[0];
  return (
    <>
      <PageHead title="Currency Exchange" lead="Each currency in Australian dollars, Finance’s base, with the rupee rate course search uses." />
      <div className="fx__bar">
        <div className="fx__week">
          <label htmlFor="fx-week" className="mbx__k">
            Week
          </label>
          <SelectMenu id="fx-week" label="Week" value={week} options={cfg.fx.map((x) => ({ value: x.week, label: `Week of ${weekText(x.week)}${x.week === thisWeek ? ' (this week)' : ''}` }))} onChange={pick} />
        </div>
        <div className="fx__acts">
          {isNow && !draft && ai === 'idle' && (
            <button
              type="button"
              className="gmail__sum-btn fx__ai"
              onClick={() => {
                setAi('busy');
                t.current = window.setTimeout(() => setAi('ready'), reduce ? 200 : 1500);
              }}
            >
              <AssistMark size={16} />
              Fetch with AI
            </button>
          )}
          <EditActions editing={!!draft} dirty={dirty} disabled={!isNow} onEdit={() => (setDraft(saved), setAi('idle'))} onCancel={() => setDraft(null)} onSave={save} />
        </div>
      </div>

      <dl className="fx__stats">
        <div>
          <dt>1 AUD in rupees</dt>
          <dd className="num">{rupees(w.inrPerAud)}</dd>
        </div>
        <div>
          <dt>Base currency</dt>
          <dd>
            AUD<span className="fx__by">Australian dollar, Finance’s base</span>
          </dd>
        </div>
        <div>
          <dt>Last changed</dt>
          <dd>
            {when(last.updated)}
            <span className="fx__by">{last.by}</span>
          </dd>
        </div>
      </dl>

      <AnimatePresence initial={false}>
        {ai !== 'idle' && (
          <motion.section
            key="ai"
            className="gmail__sum fx__ask"
            aria-live="polite"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease }}
          >
            <p className="gmail__sum-k">
              <AssistMark size={16} motion={ai === 'busy' ? 'busy' : 'idle'} /> GSP Assist · This week’s rates
            </p>
            {ai === 'busy' || !proposal ? (
              <Thinking text="Reading this week’s reference rates…" />
            ) : (
              <>
                <p className="fx__ask-t">These are this week’s reference rates. Nothing changes until you use them and save.</p>
                <ul className="fx__ask-list">
                  <li>
                    <span>AUD in rupees</span>
                    <span className="num">
                      {rupees(saved.inrPerAud)} → <b>{rupees(proposal.inrPerAud)}</b>
                    </span>
                  </li>
                  {proposal.rows
                    .filter((r) => r.code !== 'AUD')
                    .map((r) => (
                      <li key={r.code}>
                        <span>{r.code} in AUD</span>
                        <span className="num">
                          {aud(saved.rows.find((x) => x.code === r.code)!.aud)} → <b>{aud(r.aud)}</b>
                        </span>
                      </li>
                    ))}
                </ul>
                <div className="fx__ask-acts">
                  <Button variant="secondary" onClick={() => setAi('idle')}>
                    Discard
                  </Button>
                  <Button
                    onClick={() => {
                      setDraft(proposal);
                      setAi('idle');
                    }}
                  >
                    Use These Rates
                  </Button>
                </div>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <Panel flush note={!isNow ? 'A past week keeps the rates it was paid at, so it can’t be changed.' : undefined} title={!isNow ? `Week of ${weekText(saved.week)}` : undefined}>
        <div className="stab-wrap">
          <table className="itab cfg__tab fx__tab">
            <thead>
              <tr>
                <th scope="col">Currency</th>
                <th scope="col" className="is-num">
                  1 unit in AUD
                </th>
                <th scope="col" className="is-num">
                  1 unit in INR
                </th>
                <th scope="col" className="is-num">
                  Since last week
                </th>
                <th scope="col">Used for</th>
                <th scope="col">Last changed</th>
              </tr>
            </thead>
            <tbody>
              {w.rows.map((r: FxRow) => {
                const p = prev?.rows.find((x) => x.code === r.code);
                const inr = r.aud * w.inrPerAud;
                const pInr = p ? p.aud * prev!.inrPerAud : 0;
                const move = p ? ((inr - pInr) / pInr) * 100 : 0;
                const changed = !!draft && (r.aud !== saved.rows.find((x) => x.code === r.code)?.aud || (r.code === 'AUD' && w.inrPerAud !== saved.inrPerAud));
                return (
                  <tr key={r.code} className={changed ? 'is-changed' : ''}>
                    <td>
                      <span className="fx__cur">
                        <span className="fx__flag" aria-hidden="true">
                          {FLAG_OF[r.code] ?? ''}
                        </span>
                        <span>
                          <span className="cfg__strong">{r.code}</span>
                          <span className="cfg__sub">{r.name}</span>
                        </span>
                      </span>
                    </td>
                    <td className="is-num num">
                      {draft && r.code !== 'AUD' ? (
                        <TextInput id={`fx-${r.code}`} aria-label={`1 ${r.code} in Australian dollars`} inputMode="decimal" className="cfg__cellinput cfg__num" defaultValue={String(r.aud)} onChange={(e) => num(e.target.value) > 0 && setRow(r.code, num(e.target.value))} />
                      ) : (
                        aud(r.aud)
                      )}
                    </td>
                    <td className="is-num num">
                      {draft && r.code === 'AUD' ? (
                        <span className="cfg__money">
                          <span aria-hidden="true">₹</span>
                          <TextInput id="fx-inr" aria-label="1 Australian dollar in rupees" inputMode="decimal" className="cfg__cellinput cfg__num" defaultValue={String(w.inrPerAud)} onChange={(e) => num(e.target.value) > 0 && setDraft((d) => ({ ...d!, inrPerAud: num(e.target.value) }))} />
                        </span>
                      ) : (
                        rupees(Math.round(inr * 100) / 100)
                      )}
                    </td>
                    <td className="is-num num">
                      {p ? <span className={`fx__move ${Math.abs(move) < 0.005 ? 'is-flat' : move > 0 ? 'is-up' : 'is-down'}`}>{Math.abs(move) < 0.005 ? 'No change' : `${move > 0 ? '▲' : '▼'} ${Math.abs(move).toFixed(2)}%`}</span> : <span className="cfg__muted">–</span>}
                    </td>
                    <td className="cfg__muted">{r.usedFor || 'Commission (base)'}</td>
                    <td>
                      <span className="cfg__nowrap num">{when(r.updated)}</span>
                      <span className="cfg__sub">{r.by}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="cfg__foot cfg__note">Finance prices each commission line at the rate of the week it’s paid. Course search works out budgets in lakhs from the rupee column.</p>
      </Panel>
      <History log={cfg.log} area="Currency exchange" />
    </>
  );
}

const money = (cur: string, v: number) => `${cur} ${v.toLocaleString('en-GB')}`;
const FIGURES: [keyof Pick<Living, 'perYear' | 'visa' | 'health'>, string][] = [
  ['perYear', 'Living expenses a year'],
  ['visa', 'Visa fee, once'],
  ['health', 'Health insurance a year'],
];
/** The destinations' short names, as course search calls them, and the country list's. */
const ALIAS: Record<string, string> = { UK: 'United Kingdom', USA: 'United States' };
/** A country's flag from its two-letter code. */
const flagOf = (country: string) => FLAG[country as Destination] ?? (countryByName(ALIAS[country] ?? country)?.iso ?? '').toUpperCase().replace(/[A-Z]/g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
/** The currency a country added here starts with, where it's clear. */
const CURRENCY_OF: Record<string, string> = {
  Austria: 'EUR', Belgium: 'EUR', Cyprus: 'EUR', Finland: 'EUR', France: 'EUR', Germany: 'EUR', Italy: 'EUR', Latvia: 'EUR', Lithuania: 'EUR', Malta: 'EUR', Netherlands: 'EUR', Portugal: 'EUR', Spain: 'EUR',
  China: 'CNY', Denmark: 'DKK', 'Hong Kong S.A.R.': 'HKD', Japan: 'JPY', Malaysia: 'MYR', Mauritius: 'MUR', Norway: 'NOK', Singapore: 'SGD', 'South Korea': 'KRW', Sweden: 'SEK', Switzerland: 'CHF', 'United Arab Emirates': 'AED',
};
/** Cities students go to, offered when a city is added (any other can be typed). */
const CITY_HINTS: Record<string, string[]> = {
  Australia: ['Adelaide', 'Brisbane', 'Canberra', 'Darwin', 'Gold Coast', 'Hobart', 'Melbourne', 'Perth', 'Sydney'],
  UK: ['Birmingham', 'Bristol', 'Cardiff', 'Edinburgh', 'Glasgow', 'Leeds', 'Liverpool', 'London', 'Manchester', 'Nottingham'],
  Canada: ['Calgary', 'Halifax', 'Montreal', 'Ottawa', 'Toronto', 'Vancouver', 'Winnipeg'],
  'New Zealand': ['Auckland', 'Christchurch', 'Dunedin', 'Hamilton', 'Wellington'],
  Ireland: ['Cork', 'Dublin', 'Galway', 'Limerick'],
  USA: ['Boston', 'Chicago', 'Dallas', 'Los Angeles', 'New York', 'San Francisco', 'Seattle'],
};

/**
 * Living Costs and Fees (Nesil, 3 Nov, after the reference screens): a year's living costs, the visa fee and a year's
 * health insurance in each destination, in its own currency, with where they come from and who changed them last.
 * The course page's Costs uses them for the course's length (1 year when the length is in credits). It reads as it is
 * until Edit; Save Changes keeps the changes. 4 Nov (Nesil): **Add Country** with its living costs, and in each
 * country **Add City** for a city's own living costs; a city taken out while editing is asked first.
 */
export function LivingCosts({ cfg, change, say, me }: ConfigProps) {
  const [draft, setDraft] = useState<Living[] | null>(null);
  const [addingCountry, setAddingCountry] = useState(false);
  const [addingCity, setAddingCity] = useState<Living | null>(null);
  const [ask, asking] = useAsk();
  const list = draft ?? cfg.living;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(cfg.living);
  const set = (country: string, p: Partial<Living>) => setDraft((d) => d!.map((x) => (x.country === country ? { ...x, ...p } : x)));
  const setCity = (country: string, name: string, perYear: number) => setDraft((d) => d!.map((x) => (x.country === country ? { ...x, cities: x.cities.map((c) => (c.name === name ? { ...c, perYear } : c)) } : x)));
  const save = () => {
    const now = Date.now();
    const lines: string[] = [];
    const next = draft!.map((x) => {
      const was = cfg.living.find((y) => y.country === x.country)!;
      const moved = FIGURES.filter(([k]) => x[k] !== was[k]).map(([k, l]) => `${l.toLowerCase()} ${was[k] ? money(x.currency, was[k]) : 'not set'} → ${x[k] ? money(x.currency, x[k]) : 'not set'}`);
      if (x.basis !== was.basis) moved.push(`source → ${x.basis}`);
      was.cities.forEach((c) => {
        const is = x.cities.find((y) => y.name === c.name);
        if (!is) moved.push(`took out ${c.name}`);
        else if (is.perYear !== c.perYear) moved.push(`${c.name} ${money(x.currency, c.perYear)} → ${money(x.currency, is.perYear)}`);
      });
      if (!moved.length) return was;
      lines.push(`${x.country}: ${moved.join(', ')}`);
      return { ...x, updated: now, by: me };
    });
    change('Living costs', lines.join('; '), (c) => ({ ...c, living: next }));
    say(`${lines.length} ${lines.length === 1 ? 'country' : 'countries'} saved.`);
    setDraft(null);
  };
  return (
    <>
      <PageHead title="Living Costs and Fees" lead="A year’s living costs, the visa fee and a year’s health insurance in each destination, in its own currency.">
        {!draft && (
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setAddingCountry(true)}>
            Add Country
          </Button>
        )}
        <EditActions editing={!!draft} dirty={dirty} onEdit={() => setDraft(cfg.living)} onCancel={() => setDraft(null)} onSave={save} />
      </PageHead>
      <ul className="lc__grid">
        {list.map((l) => {
          const was = cfg.living.find((y) => y.country === l.country)!;
          return (
            <li key={l.country} className={`card lc ${draft && JSON.stringify(l) !== JSON.stringify(was) ? 'is-changed' : ''}`}>
              <header className="lc__head">
                <span className="lc__flag" aria-hidden="true">
                  {flagOf(l.country)}
                </span>
                <h2 className="lc__name">{l.country}</h2>
                <span className="cfg__tag">{l.currency}</span>
              </header>
              <dl className="lc__figs">
                {FIGURES.map(([k, label]) => (
                  <div key={k} className="lc__fig">
                    <dt>{label}</dt>
                    <dd className="num">
                      {draft ? (
                        <span className="cfg__money">
                          <span>{l.currency}</span>
                          <TextInput
                            id={`lv-${k}-${l.country}`}
                            aria-label={`${l.country}: ${label.toLowerCase()} in ${l.currency}`}
                            inputMode="numeric"
                            className="cfg__cellinput cfg__num"
                            defaultValue={l[k] ? l[k].toLocaleString('en-GB') : ''}
                            // the living costs are needed; the visa fee and health insurance can be left out
                            onChange={(e) => (num(e.target.value) > 0 ? set(l.country, { [k]: num(e.target.value) }) : k !== 'perYear' && !e.target.value.trim() && set(l.country, { [k]: 0 }))}
                          />
                        </span>
                      ) : l[k] ? (
                        <>
                          <span className="lc__cur">{l.currency}</span> {l[k].toLocaleString('en-GB')}
                        </>
                      ) : (
                        <span className="cfg__muted">—</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {(l.cities.length > 0 || !draft) && (
                <div className="lc__cities">
                  {l.cities.length > 0 && (
                    <>
                      <h3 className="lc__k">Cities</h3>
                      <dl className="lc__figs lc__cityfigs">
                        {l.cities.map((c) => (
                          <div key={c.name} className="lc__fig">
                            <dt>{c.name}</dt>
                            <dd className="num">
                              {draft ? (
                                <span className="cfg__money">
                                  <span>{l.currency}</span>
                                  <TextInput
                                    id={`lv-city-${l.country}-${c.name}`}
                                    aria-label={`${c.name}: living expenses a year in ${l.currency}`}
                                    inputMode="numeric"
                                    className="cfg__cellinput cfg__num"
                                    defaultValue={c.perYear.toLocaleString('en-GB')}
                                    onChange={(e) => num(e.target.value) > 0 && setCity(l.country, c.name, num(e.target.value))}
                                  />
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    aria-label={`Take ${c.name} out`}
                                    onClick={() =>
                                      ask({
                                        title: `Take ${c.name} out?`,
                                        confirm: 'Take Out',
                                        body: `Once you save, ${l.country}’s own figure is used for ${c.name}.`,
                                        run: () => setDraft((d) => d!.map((x) => (x.country === l.country ? { ...x, cities: x.cities.filter((y) => y.name !== c.name) } : x))),
                                      })
                                    }
                                  >
                                    <Icon name="close" size={16} />
                                  </button>
                                </span>
                              ) : (
                                <>
                                  <span className="lc__cur">{l.currency}</span> {c.perYear.toLocaleString('en-GB')}
                                </>
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                  {!draft && (
                    <button type="button" className="btn btn--link gc__add" onClick={() => setAddingCity(l)}>
                      <Icon name="plus" size={16} /> Add City
                    </button>
                  )}
                </div>
              )}
              <div className="lc__foot">
                {draft ? (
                  <TextInput id={`lb-${l.country}`} aria-label={`${l.country}: where the figures come from`} className="cfg__cellinput" defaultValue={l.basis} onChange={(e) => e.target.value.trim() && set(l.country, { basis: e.target.value.trim() })} />
                ) : (
                  l.basis && <p className="lc__src">{l.basis}</p>
                )}
                <p className="lc__when">
                  <Icon name="clock" size={14} /> {when(was.updated)} · {was.by}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="cfg__note">The course page’s Costs uses them for the course’s length (1 year when the length is in credits).</p>
      <History log={cfg.log} area="Living costs" />
      {asking}
      <CountryDialog
        open={addingCountry}
        have={cfg.living.flatMap((l) => [l.country, ALIAS[l.country] ?? l.country])}
        onClose={() => setAddingCountry(false)}
        onSave={(x) => {
          const figs = [`living expenses ${money(x.currency, x.perYear)}`, x.visa ? `visa fee ${money(x.currency, x.visa)}` : '', x.health ? `health insurance ${money(x.currency, x.health)}` : ''].filter(Boolean).join(', ');
          change('Living costs', `Added ${x.country}: ${figs}`, (c) => ({ ...c, living: [...c.living, { ...x, updated: Date.now(), by: me }] }));
          say(`${x.country} added.`);
          setAddingCountry(false);
        }}
      />
      <CityDialog
        open={!!addingCity}
        country={addingCity}
        onClose={() => setAddingCity(null)}
        onSave={(city) => {
          const l = addingCity!;
          change('Living costs', `${l.country}: added ${city.name}, living expenses ${money(l.currency, city.perYear)} a year`, (c) => ({
            ...c,
            living: c.living.map((x) => (x.country === l.country ? { ...x, cities: [...x.cities, city], updated: Date.now(), by: me } : x)),
          }));
          say(`${city.name} added to ${l.country}.`);
          setAddingCity(null);
        }}
      />
    </>
  );
}

/** The buttons of a pop-up, on the right. */
const Foot = ({ cta, onClose, onSave }: { cta: string; onClose: () => void; onSave: () => void }) => (
  <div className="asf">
    <div className="asf__acts">
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={onSave}>{cta}</Button>
    </div>
  </div>
);

/** A figure in a currency: the currency's code before the field. */
const MoneyInput = ({ id, cur, value, invalid, onChange, placeholder }: { id: string; cur: string; value: string; invalid?: boolean; onChange: (v: string) => void; placeholder?: string }) => (
  <TextInput id={id} inputMode="numeric" value={value} invalid={invalid} placeholder={placeholder} leading={<span className="lc__cur">{cur || '—'}</span>} onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ''))} />
);

/** Add a country (4 Nov): the country, picked from the list, its currency and its living costs; the visa fee, health
 *  insurance and where the figures come from can wait. */
function CountryDialog({ open, have, onClose, onSave }: { open: boolean; have: string[]; onClose: () => void; onSave: (l: Omit<Living, 'updated' | 'by'>) => void }) {
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const [perYear, setPerYear] = useState('');
  const [visa, setVisa] = useState('');
  const [health, setHealth] = useState('');
  const [basis, setBasis] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    [setCountry, setCurrency, setPerYear, setVisa, setHealth, setBasis].forEach((f) => f(''));
    setTried(false);
  }, [open]);
  const cur = currency.trim().toUpperCase();
  const err = {
    country: !country ? 'Pick the country.' : null,
    currency: !/^[A-Z]{3}$/.test(cur) ? 'Enter its currency’s three-letter code, like EUR.' : null,
    perYear: !(num(perYear) > 0) ? 'Enter a year’s living expenses.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({ country, currency: cur, perYear: num(perYear), visa: num(visa) || 0, health: num(health) || 0, basis: basis.trim(), cities: [] });
  };
  return (
    <Sheet open={open} onClose={onClose} center className="iform cfg__sheet" title="Add Country" footer={<Foot cta="Add Country" onClose={onClose} onSave={save} />}>
      <div className="iform__grid">
        <Field id="lc-country" label="Country" required error={show('country')}>
          <SearchPick
            id="lc-country"
            label="Country"
            value={country}
            options={COUNTRIES.filter((c) => !have.includes(c.name)).map((c) => ({ value: c.name, label: c.name }))}
            onChange={(c) => {
              setCountry(c);
              if (CURRENCY_OF[c]) setCurrency(CURRENCY_OF[c]);
            }}
            invalid={!!show('country')}
            placeholder="Search a country"
          />
        </Field>
        <Field id="lc-cur" label="Currency" required error={show('currency')}>
          <TextInput id="lc-cur" value={currency} invalid={!!show('currency')} placeholder="Like: EUR" maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </Field>
        <Field id="lc-year" label="Living expenses a year" required error={show('perYear')}>
          <MoneyInput id="lc-year" cur={cur} value={perYear} invalid={!!show('perYear')} onChange={setPerYear} />
        </Field>
        <Field id="lc-visa" label="Visa fee, once" optional>
          <MoneyInput id="lc-visa" cur={cur} value={visa} onChange={setVisa} />
        </Field>
        <Field id="lc-health" label="Health insurance a year" optional>
          <MoneyInput id="lc-health" cur={cur} value={health} onChange={setHealth} />
        </Field>
        <Field id="lc-basis" label="Where the figures come from" optional>
          <TextInput id="lc-basis" value={basis} placeholder="Like: the immigration service" onChange={(e) => setBasis(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/** Add a city's own living costs a year, in its country's currency (4 Nov). */
function CityDialog({ open, country, onClose, onSave }: { open: boolean; country: Living | null; onClose: () => void; onSave: (c: CityCost) => void }) {
  const [name, setName] = useState('');
  const [perYear, setPerYear] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName('');
    setPerYear('');
    setTried(false);
  }, [open]);
  const v = name.trim();
  const taken = (country?.cities ?? []).map((c) => c.name.toLowerCase());
  const err = {
    name: v.length < 2 ? 'Enter the city.' : taken.includes(v.toLowerCase()) ? `${v} is already on ${country?.country}.` : null,
    perYear: !(num(perYear) > 0) ? 'Enter a year’s living expenses.' : null,
  };
  const show = (k: keyof typeof err) => (tried ? err[k] : null);
  const save = () => {
    setTried(true);
    if (!Object.values(err).some(Boolean)) onSave({ name: v, perYear: num(perYear) });
  };
  const hints = (CITY_HINTS[country?.country ?? ''] ?? []).filter((c) => !taken.includes(c.toLowerCase()));
  return (
    <Sheet open={open} onClose={onClose} center className="iform cfg__sheet" title={country ? `Add City in ${country.country}` : 'Add City'} footer={<Foot cta="Add City" onClose={onClose} onSave={save} />}>
      <div className="cfg__form">
        <Field id="lc-city" label="City" required error={show('name')}>
          <TextInput id="lc-city" list="lc-cities" value={name} invalid={!!show('name')} placeholder="Choose or type" onChange={(e) => setName(e.target.value)} />
        </Field>
        <datalist id="lc-cities">
          {hints.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Field id="lc-city-year" label="Living expenses a year" required error={show('perYear')}>
          <MoneyInput id="lc-city-year" cur={country?.currency ?? ''} value={perYear} invalid={!!show('perYear')} onChange={setPerYear} />
        </Field>
      </div>
    </Sheet>
  );
}
