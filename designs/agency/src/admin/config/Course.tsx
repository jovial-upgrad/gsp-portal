import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { TextInput } from '../../components/forms';
import { FLAG } from '../../data/courses';
import { PageHead } from '../../institution/records/parts';
import { DEST_CURRENCY, type Living, type Rate } from '../data/config';
import { COUNTRIES } from '../../data/partners';
import type { ConfigProps } from './ConfigPage';
import { CellError, EditBar, History, Panel, useDraft, when } from './parts';
import { useCheck } from '../../components/validate';
import { fmtDate } from '../../data/format';
import { Empty, Loaded, Pick, SaveBanner, ViewOnlyNote, istDay, trySave, type SaveResult } from './states';
import { NumberField } from '../../components/NumberField';

const num = (v: string) => Number(v.replace(/[^\d.]/g, ''));
const fmt = (n: number) => (!n ? '' : n < 0.01 ? String(Number(n.toPrecision(3))) : n.toLocaleString('en-GB', { maximumFractionDigits: 4 }));
const DEST_NAME: Record<string, string> = { UK: 'UK', USA: 'USA' };

/** The Monday of the IST week a day is in. */
const weekStart = (t = Date.now()) => {
  const d = new Date(`${istDay(t)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

/**
 * Currency exchange (Admin › Course configuration; Jovial, 6 Nov): the search rates. One unit of each currency in AUD,
 * one set per IST week, for course search budgets in the student's own currency and course costs. They update
 * themselves every Monday (job J11): nobody enters or saves them, and a currency the fetch can't find keeps last week's
 * rate. Commissions don't use them: Finance keeps its own (Finance › Exchange rates). Past weeks are read only.
 */
export function Currency({ cfg }: ConfigProps) {
  const thisWeek = weekStart();
  const [week, setWeek] = useState(thisWeek);
  const weeks = [...new Set([thisWeek, ...cfg.fxWeeks.map((w) => w.week).filter((w) => w <= thisWeek)])].sort().reverse();
  const row = cfg.fxWeeks.find((w) => w.week === week) ?? [...cfg.fxWeeks].filter((w) => w.week <= week).sort((x, y) => (x.week < y.week ? 1 : -1))[0];
  const shown: Rate[] = cfg.rates.map((r) => ({ ...r, aud: Number(row?.[r.code] ?? r.aud) }));
  // Used for: the destinations in Living costs and fees that use it, and the student countries whose own currency it is
  const homes = (code: string) => COUNTRIES.filter((c) => c.currency === code).map((c) => c.name);
  const usedFor = (code: string) => {
    const dest = cfg.living.filter((l) => l.currency === code).map((l) => `Destination: ${DEST_NAME[l.country] ?? l.country}`);
    const h = homes(code);
    const home = h.length ? [`Students from ${h.length > 3 ? `${h.slice(0, 3).join(', ')} and ${h.length - 3} more` : h.join(', ')}`] : [];
    return [...dest, ...home].join('; ') || '—';
  };
  const missing = shown.filter((r) => r.code !== 'AUD' && !(r.aud > 0));
  return (
    <>
      <PageHead title="Currency exchange" lead="The search rates: one unit of each currency in Australian dollars. Course search reads a budget in the student’s own currency with them, and course costs add up in one currency. They update themselves every Monday at 00:30 IST; nobody saves them. Commissions use Finance’s own rates, not these.">
        <Pick id="fx-week" label="Week of" value={week} options={weeks.map((w) => [w, `Week of ${fmtDate(w)}${w === thisWeek ? ' (this week)' : ''}`] as [string, string])} onChange={setWeek} />
      </PageHead>
      {week !== thisWeek && <p className="cfg__muted">The week of {fmtDate(week)}.</p>}
      {missing.length > 0 && <p className="cfg__warnbox">No rate yet for {missing.map((r) => r.code).join(', ')}. Course search reads a budget in these currencies in the destination’s currency instead, and says so.</p>}
      <Loaded page="currency exchange" cols={4}>
        <Panel flush>
          <div className="stab-wrap">
            <table className="itab cfg__tab cfg__fx">
              <thead>
                <tr>
                  <th scope="col">Currency</th>
                  <th scope="col">1 unit in AUD</th>
                  <th scope="col" className="cfg__usedfor">Used for</th>
                  <th scope="col" className="cfg__changed">Updated</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.code}>
                    <td>
                      <span className="cfg__strong">{r.code}</span>
                      <span className="cfg__sub">{r.name}</span>
                    </td>
                    <td><span className="num">{r.code === 'AUD' ? '1' : fmt(r.aud) || '–'}</span></td>
                    <td className="cfg__muted cfg__usedfor">{usedFor(r.code)}</td>
                    <td className="cfg__muted num cfg__changed">{row ? `${fmtDate(row.week)}, weekly job` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Loaded>
      <p className="cfg__muted">Each Monday the weekly job fetches every rate and saves the week. A currency it can’t find keeps last week’s rate. A new currency appears when a country or a destination uses it.</p>
      <History log={cfg.log} area="Currency exchange" />
    </>
  );
}

/**
 * Living costs and fees (PRD slice 1; Admin › Course configuration): one row per destination: its currency (read
 * only, from the destination), the living expense a year, the visa fee (once), health insurance a year, a Note of
 * where Admin found the figures, and when it was last changed. Rows can be added and deleted. The course page's
 * Costs uses these for the course's length (1 year when the length is in credits).
 */
export function LivingCosts({ cfg, change, say, canEdit, me }: ConfigProps) {
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
        <NumberField id={`${id}-${i}`} aria-label={label} className="cfg__cellinput cfg__num" value={String(d.value[i][k] ?? '')} invalid={!!v.err(`${id}-${i}`)} aria-describedby={v.err(`${id}-${i}`) ? `${id}-${i}-error` : undefined} onBlur={v.blur(`${id}-${i}`)} onChange={(_t) => upd(i, { [k]: _t === '' ? NaN : num(_t) })} />
        <CellError id={`${id}-${i}`}>{v.err(`${id}-${i}`)}</CellError>
      </>
    ) : (
      <span className="num">
        {d.value[i].currency} {Number(d.value[i][k]).toLocaleString('en-GB')}
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
    </>
  );
}

