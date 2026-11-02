import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { TextInput } from '../../components/forms';
import { FLAG } from '../../data/courses';
import { PageHead } from '../../institution/records/parts';
import { DEST_CURRENCY, inrPerFrom, type FxWeek, type Living, type Rate } from '../data/config';
import { intakeTimesOf, withIntakeTimes } from '../data/store';
import type { IntakeTimes } from '../../data/courses';
import type { ConfigProps } from './ConfigPage';
import { CellError, EditBar, History, Panel, useDraft, when } from './parts';
import { useCheck } from '../../components/validate';
import { fmtAmount, fmtDate } from '../../data/format';
import { Empty, Loaded, Pick, SaveBanner, ViewOnlyNote, istDay, trySave, type SaveResult } from './states';

const num = (v: string) => Number(v.replace(/[^\d.]/g, ''));
/** A rate as typed: digits and one point, so "0.0" can be typed on the way to "0.05". */
const rateText = (v: string) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
const fmt = (n: number) => (!n ? '' : n < 0.01 ? String(Number(n.toPrecision(3))) : n.toLocaleString('en-GB', { maximumFractionDigits: 4 }));
const nudge4 = (v: number, pct: number) => Number(Math.max(0.0001, v * (1 + (Math.random() * 2 - 1) * pct)).toPrecision(4));
/** Up to 4 decimals, above 0. */
const rateOk = (n: number, typed?: string) => n > 0 && !/\.\d{5,}/.test(typed ?? String(n));

/** ISO 4217: the currencies Admin can add (code and name). */
const ISO_4217: [string, string][] = [
  ['AED', 'UAE dirham'], ['AUD', 'Australian dollar'], ['BDT', 'Bangladeshi taka'], ['BRL', 'Brazilian real'], ['CAD', 'Canadian dollar'], ['CHF', 'Swiss franc'], ['CNY', 'Chinese yuan'], ['CZK', 'Czech koruna'], ['DKK', 'Danish krone'], ['EUR', 'Euro'], ['GBP', 'Pound sterling'], ['GHS', 'Ghanaian cedi'], ['HKD', 'Hong Kong dollar'], ['HUF', 'Hungarian forint'], ['IDR', 'Indonesian rupiah'], ['INR', 'Indian rupee'], ['JPY', 'Japanese yen'], ['KES', 'Kenyan shilling'], ['KRW', 'South Korean won'], ['LKR', 'Sri Lankan rupee'], ['MMK', 'Myanmar kyat'], ['MUR', 'Mauritian rupee'], ['MXN', 'Mexican peso'], ['MYR', 'Malaysian ringgit'], ['NGN', 'Nigerian naira'], ['NOK', 'Norwegian krone'], ['NPR', 'Nepalese rupee'], ['NZD', 'New Zealand dollar'], ['PHP', 'Philippine peso'], ['PKR', 'Pakistani rupee'], ['PLN', 'Polish złoty'], ['SEK', 'Swedish krona'], ['SGD', 'Singapore dollar'], ['THB', 'Thai baht'], ['USD', 'US dollar'], ['VND', 'Vietnamese dong'], ['ZAR', 'South African rand'],
];
const DEST_NAME: Record<string, string> = { UK: 'UK', USA: 'USA' };

/** The Monday of the IST week a day is in. */
const weekStart = (t = Date.now()) => {
  const d = new Date(`${istDay(t)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

/**
 * Currency exchange (PRD slice 1; Admin › Course configuration): one unit of each currency in AUD (Finance's base),
 * one set of rates per IST week. 1 unit in INR and Used for are worked out. Get today's rates and Fetch with AI each
 * fill a draft that Admin saves; a currency the AI can't find keeps last week's rate and is flagged, and each fetch
 * is logged. The week picker shows this week and every past week, read only. A week with no saved rate carries the
 * week before's.
 */
export function Currency({ cfg, change, say, canEdit, me }: ConfigProps) {
  const d = useDraft<Rate[]>(cfg.rates, 'the exchange rates');
  const [fetched, setFetched] = useState<{ at: number; how: 'rates' | 'ai'; missed: string[] } | null>(null);
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [adding, setAdding] = useState('');
  const [result, setResult] = useState<SaveResult | null>(null);
  const thisWeek = weekStart();
  const [week, setWeek] = useState(thisWeek);
  const ed = d.editing;
  const past = week !== thisWeek;
  const savedThisWeek = cfg.fxWeeks.some((w) => w.week === thisWeek);
  const weekRow = cfg.fxWeeks.find((w) => w.week === week);
  const weeks = [...new Set([thisWeek, ...cfg.fxWeeks.map((w) => w.week).filter((w) => w <= thisWeek)])].sort().reverse();
  const errors: Record<string, string | null> = {};
  d.value.forEach((r, i) => {
    errors[`fx-${i}`] = r.code === 'AUD' ? null : !rateOk(r.aud, typed[i]) ? 'Enter a number above 0, with up to 4 decimals.' : null;
  });
  const v = useCheck(errors);
  const upd = (i: number, p: Partial<Rate>) => d.set((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  // Used for: the destinations in Living costs and fees that use this currency, or course search's lakh budgets for INR
  const usedFor = (code: string) => (code === 'INR' ? 'Course search budgets in lakhs' : cfg.living.filter((l) => l.currency === code).map((l) => `Course search: ${DEST_NAME[l.country] ?? l.country}`).join('; ') || '—');
  const fill = (how: 'rates' | 'ai') => {
    if (!ed) d.start();
    // the AI can't always find a rate: that row keeps last week's and is flagged (the prototype misses the dong)
    const missed = how === 'ai' ? ['VND'].filter((c) => d.value.some((r) => r.code === c)) : [];
    d.set((l) => l.map((x) => (x.code === 'AUD' || missed.includes(x.code) ? x : { ...x, aud: nudge4(x.aud || 1, 0.012), updated: Date.now() })));
    setFetched({ at: Date.now(), how, missed });
    if (how === 'ai') change('Currency exchange', `Fetch with AI run: ${d.value.length - 1 - missed.length} rates drafted${missed.length ? `; not found: ${missed.join(', ')}` : ''}`, (c) => c);
    say(how === 'ai' ? 'Rates drafted. Check them, then Save.' : 'Today’s rates are filled in. Check them, then Save.');
  };
  const save = () => {
    if (!v.submit()) return;
    const res = trySave();
    if (res !== 'ok') return setResult(res);
    const rates = d.value.map((x) => ({ ...x, by: me }));
    const changed = rates.filter((x) => cfg.rates.find((y) => y.code === x.code)?.aud !== x.aud).map((x) => `${x.code} ${fmt(cfg.rates.find((y) => y.code === x.code)?.aud ?? 0) || 'new'} → ${fmt(x.aud)}`);
    const row: FxWeek = { week: thisWeek, ...Object.fromEntries(rates.map((x) => [x.code, x.aud])) };
    change('Currency exchange', `Week of ${fmtDate(thisWeek)}: ${changed.join(', ') || 'no changes'}`, (c) => ({
      ...c,
      rates,
      fxWeeks: [...c.fxWeeks.filter((w) => w.week < thisWeek), row, ...c.fxWeeks.filter((w) => w.week > thisWeek).map((w) => ({ ...w, ...row, week: w.week }))],
    }));
    say('Saved.');
    setFetched(null);
    setTyped({});
    setResult(null);
    v.reset();
    d.stop();
  };
  const shownRates: Rate[] = past ? cfg.rates.map((r) => ({ ...r, aud: Number(weekRow?.[r.code] ?? r.aud) })) : d.value;
  return (
    <>
      <PageHead title="Currency exchange" lead="One unit of each currency in Australian dollars, Finance’s base. Finance prices each commission line at the rate of the week it’s paid, so every week keeps its own rates; course search works out its budgets in lakhs from the rupee column.">
        <Pick id="fx-week" label="Week of" value={week} options={weeks.map((w) => [w, `Week of ${fmtDate(w)}${w === thisWeek ? ' (this week)' : ''}`] as [string, string])} onChange={(w) => (setWeek(w), w !== thisWeek && d.stop())} />
        {canEdit && !past && (
          <>
            <Button variant="secondary" iconLeft={<Icon name="refresh" size={18} />} onClick={() => fill('rates')}>
              Get today’s rates
            </Button>
            <Button variant="secondary" iconLeft={<Icon name="sparkle" size={18} />} onClick={() => fill('ai')}>
              Fetch with AI
            </Button>
            <EditBar name="exchange rates" editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => (setFetched(null), setTyped({}), setResult(null), v.reset(), d.stop())} onSave={save} />
          </>
        )}
      </PageHead>
      {!canEdit && <ViewOnlyNote />}
      {ed && <SaveBanner result={result} onReload={d.stop} />}
      {fetched && (
        <p className="cfg__warnbox cfg__editing">
          {fetched.how === 'ai' ? 'Fetched with AI' : 'Today’s rates filled in'} {when(fetched.at)}. Nothing is saved until you review it and click Save.
          {fetched.missed.length ? ` Not found: ${fetched.missed.join(', ')} (keeps last week’s rate).` : ''}
        </p>
      )}
      {past && <p className="cfg__muted">The week of {fmtDate(week)}, read only.</p>}
      {!past && !savedThisWeek && <p className="cfg__warnbox">No rates saved for the week of {fmtDate(thisWeek)}. Last week’s rates apply until you save.</p>}
      <Loaded page="currency exchange" cols={5}>
        <Panel flush>
          <div className="stab-wrap">
            <table className="itab cfg__tab cfg__fx">
              <thead>
                <tr>
                  <th scope="col">Currency</th>
                  <th scope="col">1 unit in AUD</th>
                  <th scope="col">1 unit in INR</th>
                  <th scope="col" className="cfg__usedfor">Used for</th>
                  <th scope="col" className="cfg__changed">Last changed</th>
                  {ed && (
                    <th scope="col">
                      <span className="vh">Remove</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {shownRates.map((r, i) => (
                  <tr key={r.code}>
                    <td>
                      <span className="cfg__strong">{r.code}</span>
                      <span className="cfg__sub">{r.name}</span>
                    </td>
                    <td>
                      {ed && !past && r.code !== 'AUD' ? (
                        <>
                          <TextInput
                            id={`fx-${i}`}
                            aria-label={`1 ${r.code} in Australian dollars`}
                            inputMode="decimal"
                            className="cfg__cellinput cfg__num"
                            value={typed[i] ?? String(r.aud || '')}
                            invalid={!!v.err(`fx-${i}`)}
                            aria-describedby={v.err(`fx-${i}`) ? `fx-${i}-error` : undefined}
                            onBlur={() => v.blur(`fx-${i}`)()}
                            onChange={(e) => {
                              const t = rateText(e.target.value);
                              setTyped((x) => ({ ...x, [i]: t }));
                              upd(i, { aud: num(t), updated: Date.now() });
                            }}
                          />
                          <CellError id={`fx-${i}`}>{v.err(`fx-${i}`)}</CellError>
                          {fetched?.missed.includes(r.code) && (
                            <span className="cfg__cellwarn">
                              <Icon name="alert" size={14} /> Not found: last week’s rate kept
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="num">{r.code === 'AUD' ? '1' : fmt(r.aud)}</span>
                      )}
                    </td>
                    <td className="cfg__muted num">{r.code === 'INR' ? '1' : inrPerFrom(shownRates, r.code) ? `₹${fmt(Math.round(inrPerFrom(shownRates, r.code)! * 100) / 100)}` : '–'}</td>
                    <td className="cfg__muted cfg__usedfor">{usedFor(r.code)}</td>
                    <td className="cfg__muted num cfg__changed">
                      {when(r.updated)}
                      {(r as Rate & { by?: string }).by && <span className="cfg__sub">{(r as Rate & { by?: string }).by}</span>}
                    </td>
                    {ed && (
                      <td className="cfg__acts">
                        {r.code !== 'AUD' && r.code !== 'INR' && !cfg.living.some((l) => l.currency === r.code) && (
                          <button type="button" className="icon-btn" aria-label={`Remove ${r.code}`} onClick={() => d.set((l) => l.filter((_, j) => j !== i))}>
                            <Icon name="close" size={16} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ed && (
            <div className="cfg__addrow cfg__add">
              <Pick id="fx-add" label="Currency to add" value={adding} placeholder="Pick a currency (ISO 4217)" options={ISO_4217.map(([c, n]) => [c, d.value.some((x) => x.code === c) ? `${c} · ${n} (already in the table)` : `${c} · ${n}`] as [string, string])} onChange={setAdding} />
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Icon name="plus" size={16} />}
                disabled={!adding || d.value.some((x) => x.code === adding)}
                onClick={() => {
                  const name = ISO_4217.find(([c]) => c === adding)?.[1] ?? adding;
                  // the default is last week's rate; a new currency starts empty
                  d.set((l) => [...l, { code: adding, name, aud: 0, usedFor: '', updated: Date.now() }]);
                  setAdding('');
                }}
              >
                Add currency
              </Button>
              {adding && d.value.some((x) => x.code === adding) && <span className="cfg__err">This currency is already in the table.</span>}
            </div>
          )}
        </Panel>
      </Loaded>
      <p className="cfg__muted">Saving sets this week’s rates (the week of {fmtDate(thisWeek)}, an IST week). Earlier weeks stay as they were. If next week has no rates by Friday 01:00 IST, a task goes to the Admin queue.</p>
      <History log={cfg.log} area="Currency exchange" />
    </>
  );
}

/**
 * Living costs and fees (PRD slice 1; Admin › Course configuration): one row per destination: its currency (read
 * only, from the destination), the living expense a year, the visa fee (once), health insurance a year, a Note of
 * where Admin found the figures, and when it was last changed. Rows can be added and deleted. The course page's
 * Costs uses these for the course's length (1 year when the length is in credits). Intake timings sit below.
 */
export function LivingCosts({ cfg, change, say, canEdit, me, role }: ConfigProps) {
  const d = useDraft<Living[]>(cfg.living, 'the living costs and fees');
  const [adding, setAdding] = useState('');
  const [result, setResult] = useState<SaveResult | null>(null);
  const ed = d.editing;
  const errors: Record<string, string | null> = {};
  d.value.forEach((l, i) => {
    errors[`lv-${i}`] = !(l.perYear > 0) || !Number.isInteger(l.perYear) ? 'Enter an amount above 0.' : null;
    errors[`lvv-${i}`] = !(l.visa >= 0) || !Number.isInteger(l.visa) ? 'Enter an amount, or 0.' : null;
    errors[`lvh-${i}`] = !(l.health >= 0) || !Number.isInteger(l.health) ? 'Enter an amount, or 0.' : null;
  });
  const v = useCheck(errors);
  const upd = (i: number, p: Partial<Living>) => d.set((l) => l.map((x, j) => (j === i ? { ...x, ...p, updated: Date.now(), by: me } : x)));
  const save = () => {
    if (!v.submit()) return;
    const res = trySave();
    if (res !== 'ok') return setResult(res);
    const diffs: string[] = [];
    for (const l of d.value) {
      const was = cfg.living.find((y) => y.country === l.country);
      if (!was) diffs.push(`added ${l.country} (${l.currency} ${l.perYear}, visa ${l.visa}, health ${l.health})`);
      else
        (
          [
            ['living', was.perYear, l.perYear],
            ['visa fee', was.visa, l.visa],
            ['health insurance', was.health, l.health],
          ] as [string, number, number][]
        ).forEach(([k, a, b]) => a !== b && diffs.push(`${l.country} ${k} ${a} → ${b}`));
      if (was && was.note !== l.note) diffs.push(`${l.country} note`);
    }
    cfg.living.filter((x) => !d.value.some((y) => y.country === x.country)).forEach((x) => diffs.push(`deleted ${x.country}`));
    change('Living costs and fees', diffs.join('; ') || 'No changes', (c) => ({ ...c, living: d.value }));
    say('Saved.');
    setResult(null);
    v.reset();
    d.stop();
  };
  const free = Object.keys(DEST_CURRENCY).filter((c) => !d.value.some((l) => l.country === c));
  const amount = (i: number, k: 'perYear' | 'visa' | 'health', id: string, label: string) =>
    ed ? (
      <>
        <TextInput id={`${id}-${i}`} aria-label={label} inputMode="numeric" className="cfg__cellinput cfg__num" value={String(d.value[i][k] ?? '')} invalid={!!v.err(`${id}-${i}`)} aria-describedby={v.err(`${id}-${i}`) ? `${id}-${i}-error` : undefined} onBlur={v.blur(`${id}-${i}`)} onChange={(e) => upd(i, { [k]: e.target.value === '' ? NaN : num(e.target.value) })} />
        <CellError id={`${id}-${i}`}>{v.err(`${id}-${i}`)}</CellError>
      </>
    ) : (
      <span className="num">
        {d.value[i].currency} {fmtAmount(d.value[i][k], d.value[i].currency)}
      </span>
    );
  return (
    <>
      <PageHead title="Living costs and fees" lead="A year’s living costs, the visa fee and a year’s health insurance in each destination, in its own currency. The course page’s Costs uses them for the course’s length (1 year when the length is in credits).">
        {canEdit && <EditBar name="living costs and fees" editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => (setResult(null), v.reset(), d.stop())} onSave={save} />}
      </PageHead>
      {!canEdit && <ViewOnlyNote />}
      {ed && <SaveBanner result={result} onReload={d.stop} />}
      <Loaded page="living costs and fees" cols={6}>
        <Panel flush>
          {!d.value.length ? (
            <Empty>No destinations yet.</Empty>
          ) : (
            <div className="stab-wrap">
              <table className="itab cfg__tab">
                <thead>
                  <tr>
                    <th scope="col">Destination</th>
                    <th scope="col">Currency</th>
                    <th scope="col">Living expense per year</th>
                    <th scope="col">Visa fee (once)</th>
                    <th scope="col">Health insurance per year</th>
                    <th scope="col">Last changed</th>
                    {ed && (
                      <th scope="col">
                        <span className="vh">Delete</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {d.value.map((l, i) => (
                    <tr key={l.country}>
                      <td className="cfg__strong">
                        <span aria-hidden="true">{FLAG[l.country as keyof typeof FLAG] ?? ''}</span> {l.country}
                        {ed ? (
                          <TextInput id={`lvn-${i}`} aria-label={`${l.country}: note`} className="cfg__cellinput" maxLength={120} placeholder="Note: where the figures come from" value={l.note} onChange={(e) => upd(i, { note: e.target.value })} />
                        ) : (
                          l.note && <span className="cfg__sub">{l.note}</span>
                        )}
                      </td>
                      <td className="cfg__muted">{l.currency}</td>
                      <td>{amount(i, 'perYear', 'lv', `${l.country}: living expense per year`)}</td>
                      <td>{amount(i, 'visa', 'lvv', `${l.country}: visa fee, once`)}</td>
                      <td>{amount(i, 'health', 'lvh', `${l.country}: health insurance per year`)}</td>
                      <td className="cfg__muted num">
                        {when(l.updated)}
                        {l.by && <span className="cfg__sub">{l.by}</span>}
                      </td>
                      {ed && (
                        <td className="cfg__acts">
                          <button type="button" className="icon-btn" aria-label={`Delete ${l.country}`} onClick={() => d.set((x) => x.filter((_, j) => j !== i))}>
                            <Icon name="close" size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {ed && (
            <div className="cfg__addrow cfg__add">
              <Pick id="lv-add" label="Destination to add" value={adding} placeholder="Pick a destination" options={free} onChange={setAdding} />
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Icon name="plus" size={16} />}
                disabled={!adding}
                onClick={() => {
                  d.set((l) => [...l, { country: adding, currency: DEST_CURRENCY[adding], perYear: NaN, visa: NaN, health: NaN, note: '', updated: Date.now(), by: me }]);
                  setAdding('');
                }}
              >
                Add destination
              </Button>
            </div>
          )}
        </Panel>
      </Loaded>
      <History log={cfg.log} area="Living costs and fees" />
      <IntakeTimings cfg={cfg} change={change} say={say} canEdit={canEdit} me={me} role={role} />
    </>
  );
}

/* ---------- intake timings (PRD slice 1, Course configuration) ---------- */

const TIMES: [keyof IntakeTimes, string, string, [number, number]][] = [
  ['lateDays', 'Late after the deadline', 'An intake still shows, as “Late: likelihood is low”, for this long after its application deadline. Then it’s closed.', [0, 60]],
  ['warnDays', 'Deadline soon', 'An open intake is marked as closing soon.', [1, 90]],
  ['countdownDays', 'Countdown', 'An intake shows “closes in N days” once its deadline is this many days away.', [1, 180]],
];

/**
 * Intake timings: how course search times each intake, in whole calendar days counted on IST dates. Read by course
 * search (slice 3) and the course pages (slice 2). Read only until Edit; changes are logged.
 */
function IntakeTimings({ cfg, change, say, canEdit }: ConfigProps) {
  const saved = intakeTimesOf(cfg);
  const d = useDraft<IntakeTimes>(saved, 'the intake timings');
  const [result, setResult] = useState<SaveResult | null>(null);
  const ed = d.editing;
  const errors: Record<string, string | null> = {};
  for (const [k, , , [lo, hi]] of TIMES) {
    const n = d.value[k];
    errors[`it-${k}`] = !Number.isInteger(n) || n < lo || n > hi ? (k === 'warnDays' ? 'Enter a whole number from 1 to 90, no more than Countdown.' : `Enter a whole number from ${lo} to ${hi}.`) : null;
  }
  if (!errors['it-warnDays'] && !errors['it-countdownDays'] && d.value.warnDays > d.value.countdownDays) errors['it-warnDays'] = 'Enter a whole number from 1 to 90, no more than Countdown.';
  const v = useCheck(errors);
  const save = () => {
    if (!v.submit()) return;
    const res = trySave();
    if (res !== 'ok') return setResult(res);
    const t = d.value;
    const diffs = TIMES.filter(([k]) => saved[k] !== t[k]).map(([k, label]) => `${label} ${saved[k]} → ${t[k]} days`);
    change('Intake timings', diffs.join('; ') || 'No changes', (c) => withIntakeTimes(c, t));
    say('Saved.');
    setResult(null);
    v.reset();
    d.stop();
  };
  return (
    <>
      <Panel
        flush
        title="Intake timings"
        note="How course search times each intake, in calendar days counted on IST dates."
        action={canEdit && <EditBar name="intake timings" editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => (setResult(null), v.reset(), d.stop())} onSave={save} />}
      >
        {ed && <SaveBanner result={result} onReload={d.stop} />}
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Setting</th>
                <th scope="col">Days</th>
                <th scope="col">Allowed</th>
                <th scope="col">Means</th>
              </tr>
            </thead>
            <tbody>
              {TIMES.map(([k, label, what, [lo, hi]]) => (
                <tr key={k}>
                  <td className="cfg__strong">{label}</td>
                  <td>
                    {ed ? (
                      <>
                        <TextInput id={`it-${k}`} aria-label={`${label}, in days`} inputMode="numeric" className="cfg__cellinput cfg__num" value={Number.isNaN(d.value[k]) ? '' : String(d.value[k])} invalid={!!v.err(`it-${k}`)} aria-describedby={v.err(`it-${k}`) ? `it-${k}-error` : undefined} onBlur={v.blur(`it-${k}`)} onChange={(e) => d.set((x) => ({ ...x, [k]: e.target.value === '' ? NaN : Number(e.target.value.replace(/[^\d]/g, '')) }))} />
                        <CellError id={`it-${k}`}>{v.err(`it-${k}`)}</CellError>
                      </>
                    ) : (
                      <span className="num">{saved[k]} days</span>
                    )}
                  </td>
                  <td className="cfg__muted num">
                    {lo} to {hi}
                    {k === 'warnDays' ? ', no more than Countdown' : ''}
                  </td>
                  <td className="cfg__muted">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <History log={cfg.log} area="Intake timings" />
    </>
  );
}
