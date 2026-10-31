import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { TextInput } from '../../components/forms';
import { FLAG } from '../../data/courses';
import { PageHead } from '../../institution/records/parts';
import { inrPerFrom, type FxWeek, type Living, type Rate, type VisaFee } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { CellError, EditBar, History, Panel, useDraft, when } from './parts';
import { useCheck } from '../../components/validate';
import { fmtAmount } from '../../data/format';

const num = (v: string) => Number(v.replace(/[^\d.]/g, ''));
/** A rate as typed: digits and one point, so "0.0" can be typed on the way to "0.05". */
const rateText = (v: string) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
const fmt = (n: number) => (!n ? '' : n < 0.01 ? String(Number(n.toPrecision(3))) : n.toLocaleString('en-GB', { maximumFractionDigits: 4 }));
const nudge4 = (v: number, pct: number) => Number((v * (1 + (Math.random() * 2 - 1) * pct)).toPrecision(4));

/**
 * Currency exchange: the one source for exchange rates (Jovial, 31 Oct). One unit of each currency in Australian
 * dollars, Finance's base; course search works out its budget in lakhs from these (the rupee column), and Finance
 * prices each line at the rate of the week it's paid. Read-only until Edit, kept only on Save, which also sets this
 * week's row; **Get today's rates** fills every rate from the rates service (in the prototype, a small move from the
 * last rate) for you to check and save. More currencies can be added.
 */
const weekStart = (t = Date.now()) => {
  const d = new Date(t);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
export function Currency({ cfg, change, say }: ConfigProps) {
  const d = useDraft<Rate[]>(cfg.rates, 'the exchange rates');
  const [fetched, setFetched] = useState<number | null>(null);
  // what's typed in each rate box while it isn't a number yet ("0.0")
  const [typed, setTyped] = useState<Record<number, string>>({});
  const ed = d.editing;
  // QC, 1 Nov: a code and a rate for each, no code twice; a rate that moves more than 20% is flagged, not refused
  const errors: Record<string, string | null> = {};
  d.value.forEach((r, i) => {
    const code = r.code.trim().toUpperCase();
    errors[`fxc-${i}`] = !code ? 'Enter the currency code, like EUR.' : !/^[A-Z]{3}$/.test(code) ? 'A currency code is 3 letters, like EUR.' : d.value.some((x, j) => j < i && x.code.trim().toUpperCase() === code) ? `There’s already a currency with the code ${code}.` : null;
    errors[`fx-${i}`] = r.code === 'AUD' ? null : !r.aud ? `Enter 1 ${code || 'unit'} in Australian dollars, more than 0.` : null;
  });
  const v = useCheck(errors);
  const moved = (r: Rate) => {
    const was = cfg.rates.find((x) => x.code === r.code)?.aud;
    if (!was || !r.aud || r.code === 'AUD') return null;
    const pct = Math.round(((r.aud - was) / was) * 100);
    return Math.abs(pct) > 20 ? `${Math.abs(pct)}% ${pct > 0 ? 'more' : 'less'} than the saved rate (${fmt(was)}). Check it before you Save.` : null;
  };
  const upd = (i: number, p: Partial<Rate>) => d.set((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const inr = (code: string, rates: Rate[]) => inrPerFrom(rates, code);
  const fetchRates = () => {
    if (!ed) d.start();
    d.set((l) => l.map((x) => (x.aud && x.code !== 'AUD' ? { ...x, aud: nudge4(x.aud, 0.012), updated: Date.now() } : x)));
    setFetched(Date.now());
    say('Today’s rates are filled in. Check them, then Save.');
  };
  const save = () => {
    if (!v.submit()) return;
    const rates = d.value.map((x) => ({ ...x, code: x.code.trim().toUpperCase() }));
    const changed = rates.filter((x) => JSON.stringify(x) !== JSON.stringify(cfg.rates.find((y) => y.code === x.code))).map((x) => `${x.code} AUD ${x.aud}`);
    const week = weekStart();
    const row: FxWeek = { week, ...Object.fromEntries(rates.map((x) => [x.code, x.aud])) };
    change('Currency exchange', `Saved ${changed.join(', ') || 'no changes'} for the week of ${week}${fetched ? ' (rates fetched)' : ''}`, (c) => ({
      ...c,
      rates,
      fxWeeks: [...c.fxWeeks.filter((w) => w.week < week), row, ...c.fxWeeks.filter((w) => w.week > week).map((w) => ({ ...w, ...row, week: w.week }))],
    }));
    say('Exchange rates saved. Course search and Finance use them from now.');
    setFetched(null);
    setTyped({});
    v.reset();
    d.stop();
  };
  return (
    <>
      <PageHead title="Currency exchange" lead="The exchange rates every part of GSP uses: one unit of each currency in Australian dollars. Course search works out its budget in lakhs from these, and Finance prices each commission line at the rate of the week it’s paid.">
        <Button variant="secondary" iconLeft={<Icon name="refresh" size={18} />} onClick={fetchRates}>
          Get today’s rates
        </Button>
        <EditBar name="exchange rates" editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => { setFetched(null); setTyped({}); v.reset(); d.stop(); }} onSave={save} />
      </PageHead>
      {fetched && <p className="cfg__warnbox cfg__editing">Rates fetched {when(fetched)}. Nothing changes until you Save.</p>}
      <Panel flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab cfg__fx">
            <thead>
              <tr>
                <th scope="col">Currency</th>
                <th scope="col" className="cfg__usedfor">Used for</th>
                <th scope="col">1 unit in AUD</th>
                <th scope="col">1 unit in INR</th>
                <th scope="col" className="cfg__changed">Last changed</th>
                {ed && <th scope="col"><span className="vh">Remove</span></th>}
              </tr>
            </thead>
            <tbody>
              {d.value.map((r, i) => (
                <tr key={i}>
                  <td>
                    {ed && !cfg.rates.some((x) => x.code === r.code && x.name === r.name) ? (
                      <span className="cfg__pair">
                        <TextInput id={`fxc-${i}`} aria-label={`Row ${i + 1}: currency code`} className="cfg__cellinput cfg__code" placeholder="Code" maxLength={3} value={r.code} invalid={!!v.err(`fxc-${i}`)} aria-describedby={v.err(`fxc-${i}`) ? `fxc-${i}-error` : undefined} onBlur={v.blur(`fxc-${i}`)} onChange={(e) => upd(i, { code: e.target.value.toUpperCase() })} />
                        <TextInput id={`fxn-${i}`} aria-label={`Row ${i + 1}: currency name`} className="cfg__cellinput" placeholder="Name" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} />
                      </span>
                    ) : (
                      <>
                        <span className="cfg__strong">{r.code}</span>
                        <span className="cfg__sub">{r.name}</span>
                      </>
                    )}
                    <CellError id={`fxc-${i}`}>{v.err(`fxc-${i}`)}</CellError>
                  </td>
                  <td className="cfg__muted cfg__usedfor">
                    {ed ? <TextInput id={`fxu-${i}`} aria-label={`${r.code}: used for`} className="cfg__cellinput" placeholder="Where it’s used" value={r.usedFor} onChange={(e) => upd(i, { usedFor: e.target.value })} /> : r.usedFor || '–'}
                  </td>
                  <td>
                    {ed && r.code !== 'AUD' ? (
                      <>
                        <TextInput
                          id={`fx-${i}`}
                          aria-label={`1 ${r.code || 'unit'} in Australian dollars`}
                          inputMode="decimal"
                          className="cfg__cellinput cfg__num"
                          value={typed[i] ?? String(r.aud || '')}
                          invalid={!!v.err(`fx-${i}`)}
                          aria-describedby={v.err(`fx-${i}`) ? `fx-${i}-error` : moved(r) ? `fx-${i}-warn` : undefined}
                          onBlur={() => (v.blur(`fx-${i}`)(), setTyped((t) => { const n = { ...t }; delete n[i]; return n; }))}
                          onChange={(e) => {
                            const t = rateText(e.target.value);
                            setTyped((x) => ({ ...x, [i]: t }));
                            upd(i, { aud: num(t), updated: Date.now() });
                          }}
                        />
                        <CellError id={`fx-${i}`}>{v.err(`fx-${i}`)}</CellError>
                        {!v.err(`fx-${i}`) && moved(r) && (
                          <span className="cfg__cellwarn" id={`fx-${i}-warn`}>
                            <Icon name="alert" size={14} /> {moved(r)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="num">{r.code === 'AUD' ? '1' : fmt(r.aud)}</span>
                    )}
                  </td>
                  <td className="cfg__muted num">{r.code === 'INR' ? '1' : inr(r.code, d.value) ? `₹${fmt(Math.round(inr(r.code, d.value)! * 100) / 100)}` : '–'}</td>
                  <td className="cfg__muted num cfg__changed">{when(r.updated)}</td>
                  {ed && (
                    <td className="cfg__acts">
                      {r.code !== 'AUD' && r.code !== 'INR' && (
                        <button type="button" className="icon-btn" aria-label={`Remove ${r.code || 'this row'}`} onClick={() => d.set((l) => l.filter((_, j) => j !== i))}>
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
          <div className="cfg__addrow">
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Icon name="plus" size={16} />}
              onClick={() => {
                d.set((l) => [...l, { code: '', name: '', aud: 0, usedFor: '', updated: Date.now() }]);
                window.setTimeout(() => document.getElementById(`fxc-${d.value.length}`)?.focus(), 40);
              }}
            >
              Add currency
            </Button>
          </div>
        )}
      </Panel>
      <p className="cfg__muted">Saving sets this week’s rates (week of {weekStart()}). Earlier weeks stay as they were, so commission already paid keeps its rate. {cfg.fxWeeks.length} weeks on file.</p>
      <History log={cfg.log} area="Currency exchange" />
    </>
  );
}

/**
 * Living costs: a year's living costs in each destination, as its visa rules set them; the course dialog adds it to
 * the first year. Jovial, 31 Oct: the same as Currency exchange: Edit, then Save; **Get current figures** fills them
 * from each country's visa rules (in the prototype, the figures as they stand) for you to check; destinations can be
 * added.
 */
export function LivingCosts({ cfg, change, say }: ConfigProps) {
  const d = useDraft<Living[]>(cfg.living, 'the living costs');
  const [fetched, setFetched] = useState<number | null>(null);
  const ed = d.editing;
  const errors: Record<string, string | null> = {};
  d.value.forEach((l, i) => {
    errors[`lvn-${i}`] = !l.country.trim() ? 'Enter the destination.' : d.value.some((x, j) => j < i && x.country.trim().toLowerCase() === l.country.trim().toLowerCase()) ? `${l.country.trim()} is already on the list.` : null;
    errors[`lvc-${i}`] = !/^[A-Z]{3}$/.test(l.currency.trim()) ? 'Enter the currency code: 3 letters, like AUD.' : null;
    errors[`lv-${i}`] = !l.perYear ? 'Enter a year’s living costs, more than 0.' : null;
  });
  const v = useCheck(errors);
  const upd = (i: number, p: Partial<Living>) => d.set((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const fetchFigures = () => {
    if (!ed) d.start();
    d.set((l) => l.map((x) => (x.perYear ? { ...x, updated: Date.now() } : x)));
    setFetched(Date.now());
    say('Checked against each country’s visa rules. Nothing has moved since the last change; Save to record the check.');
  };
  const save = () => {
    if (!v.submit()) return;
    const changed = d.value.filter((x) => JSON.stringify(x) !== JSON.stringify(cfg.living.find((y) => y.country === x.country))).map((x) => `${x.country} ${x.currency} ${x.perYear.toLocaleString('en-GB')}`);
    change('Living costs', `Saved ${changed.join(', ') || 'no changes'}${fetched ? ' (figures checked)' : ''}`, (c) => ({ ...c, living: d.value }));
    say('Living costs saved.');
    setFetched(null);
    v.reset();
    d.stop();
  };
  return (
    <>
      <PageHead title="Living costs" lead="A year’s living costs in each destination, as its visa rules set them. The course page shows it under Other costs and adds it to the first year, all in, for every course there.">
        <Button variant="secondary" iconLeft={<Icon name="refresh" size={18} />} onClick={fetchFigures}>
          Get current figures
        </Button>
        <EditBar name="living costs" editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => { setFetched(null); v.reset(); d.stop(); }} onSave={save} />
      </PageHead>
      {fetched && <p className="cfg__warnbox cfg__editing">Figures checked {when(fetched)}. Nothing changes until you Save.</p>}
      <Panel flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Destination</th>
                <th scope="col">A year (visa figure)</th>
                <th scope="col">Where it comes from</th>
                <th scope="col">Last changed</th>
                {ed && <th scope="col"><span className="vh">Remove</span></th>}
              </tr>
            </thead>
            <tbody>
              {d.value.map((l, i) => (
                <tr key={i}>
                  <td className="cfg__strong">
                    {ed && !cfg.living.some((x) => x.country === l.country) ? (
                      <TextInput id={`lvn-${i}`} aria-label={`Row ${i + 1}: destination`} className="cfg__cellinput" placeholder="Destination" value={l.country} invalid={!!v.err(`lvn-${i}`)} aria-describedby={v.err(`lvn-${i}`) ? `lvn-${i}-error` : undefined} onBlur={v.blur(`lvn-${i}`)} onChange={(e) => upd(i, { country: e.target.value })} />
                    ) : (
                      <>
                        <span aria-hidden="true">{FLAG[l.country as keyof typeof FLAG] ?? ''}</span> {l.country}
                      </>
                    )}
                    <CellError id={`lvn-${i}`}>{v.err(`lvn-${i}`)}</CellError>
                  </td>
                  <td>
                    {ed ? (
                      <>
                      <span className="cfg__money">
                        <TextInput id={`lvc-${i}`} aria-label={`${l.country || `Row ${i + 1}`}: currency`} className="cfg__cellinput cfg__code" maxLength={3} value={l.currency} invalid={!!v.err(`lvc-${i}`)} aria-describedby={v.err(`lvc-${i}`) ? `lvc-${i}-error` : undefined} onBlur={v.blur(`lvc-${i}`)} onChange={(e) => upd(i, { currency: e.target.value.toUpperCase() })} />
                        <TextInput id={`lv-${i}`} aria-label={`${l.country || `Row ${i + 1}`}: a year’s living costs`} inputMode="numeric" className="cfg__cellinput cfg__num" value={fmt(l.perYear)} invalid={!!v.err(`lv-${i}`)} aria-describedby={v.err(`lv-${i}`) ? `lv-${i}-error` : undefined} onBlur={v.blur(`lv-${i}`)} onChange={(e) => upd(i, { perYear: num(e.target.value), updated: Date.now() })} />
                      </span>
                      <CellError id={`lvc-${i}`}>{v.err(`lvc-${i}`)}</CellError>
                      <CellError id={`lv-${i}`}>{v.err(`lv-${i}`)}</CellError>
                      </>
                    ) : (
                      <span className="num">
                        {l.currency} {fmtAmount(l.perYear, l.currency)}
                      </span>
                    )}
                  </td>
                  <td>{ed ? <TextInput id={`lb-${i}`} aria-label={`${l.country}: where the figure comes from`} className="cfg__cellinput" value={l.basis} onChange={(e) => upd(i, { basis: e.target.value })} /> : <span className="cfg__muted">{l.basis}</span>}</td>
                  <td className="cfg__muted num">{when(l.updated)}</td>
                  {ed && (
                    <td className="cfg__acts">
                      <button type="button" className="icon-btn" aria-label={`Remove ${l.country || 'this row'}`} onClick={() => d.set((x) => x.filter((_, j) => j !== i))}>
                        <Icon name="close" size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ed && (
          <div className="cfg__addrow">
            <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={() => d.set((l) => [...l, { country: '', currency: '', perYear: 0, basis: '', updated: Date.now() }])}>
              Add destination
            </Button>
          </div>
        )}
      </Panel>
      <History log={cfg.log} area="Living costs" />
    </>
  );
}

/**
 * Visa and health fees (Jovial, 31 Oct): what a student pays to study in each destination, besides tuition and
 * living costs: the visa, health cover. Set up like Living costs: Edit, then Save; rows can be added. The course page's
 * Other costs and its first year, all in, read them.
 */
export function VisaFees({ cfg, change, say }: ConfigProps) {
  const d = useDraft<VisaFee[]>(cfg.visaFees, 'the visa and health fees');
  const ed = d.editing;
  const upd = (i: number, p: Partial<VisaFee>) => d.set((l) => l.map((x, j) => (j === i ? { ...x, ...p, updated: Date.now() } : x)));
  const errors: Record<string, string | null> = {};
  d.value.forEach((f, i) => {
    errors[`vfd-${i}`] = !f.country.trim() ? 'Enter the destination.' : null;
    errors[`vfl-${i}`] = !f.label.trim() ? 'Enter the fee’s name, like Student visa.' : null;
    errors[`vfc-${i}`] = !/^[A-Z]{3}$/.test(f.currency.trim()) ? 'Enter the currency code: 3 letters, like AUD.' : null;
    errors[`vfa-${i}`] = !f.amount ? 'Enter the amount, more than 0.' : null;
  });
  const v = useCheck(errors);
  const save = () => {
    if (!v.submit()) return;
    const changed = d.value.filter((x) => JSON.stringify(x) !== JSON.stringify(cfg.visaFees.find((y) => y.id === x.id))).map((x) => `${x.country} · ${x.label} ${x.currency} ${x.amount.toLocaleString('en-GB')}`);
    change('Visa and health fees', `Saved ${changed.join(', ') || 'no changes'}`, (c) => ({ ...c, visaFees: d.value }));
    say('Visa and health fees saved. Course pages show them from now.');
    v.reset();
    d.stop();
  };
  return (
    <>
      <PageHead title="Visa and health fees" lead="What a student pays to study in each destination besides tuition and living costs. The course page lists them under Other costs and adds them to the first year, all in.">
        <EditBar name="visa and health fees" editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => (v.reset(), d.stop())} onSave={save} />
      </PageHead>
      <Panel flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Destination</th>
                <th scope="col">Fee</th>
                <th scope="col">Amount</th>
                <th scope="col">How often</th>
                <th scope="col">Where it comes from</th>
                <th scope="col">Last changed</th>
                {ed && <th scope="col"><span className="vh">Remove</span></th>}
              </tr>
            </thead>
            <tbody>
              {d.value.map((f, i) => (
                <tr key={f.id}>
                  <td className="cfg__strong">
                    {ed ? (
                      <>
                        <TextInput id={`vfd-${i}`} aria-label={`Row ${i + 1}: destination`} className="cfg__cellinput" value={f.country} invalid={!!v.err(`vfd-${i}`)} aria-describedby={v.err(`vfd-${i}`) ? `vfd-${i}-error` : undefined} onBlur={v.blur(`vfd-${i}`)} onChange={(e) => upd(i, { country: e.target.value })} />
                        <CellError id={`vfd-${i}`}>{v.err(`vfd-${i}`)}</CellError>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">{FLAG[f.country as keyof typeof FLAG] ?? ''}</span> {f.country}
                      </>
                    )}
                  </td>
                  <td>
                    {ed ? (
                      <>
                        <TextInput id={`vfl-${i}`} aria-label={`${f.country || `Row ${i + 1}`}: fee`} className="cfg__cellinput" value={f.label} invalid={!!v.err(`vfl-${i}`)} aria-describedby={v.err(`vfl-${i}`) ? `vfl-${i}-error` : undefined} onBlur={v.blur(`vfl-${i}`)} onChange={(e) => upd(i, { label: e.target.value })} />
                        <CellError id={`vfl-${i}`}>{v.err(`vfl-${i}`)}</CellError>
                      </>
                    ) : (
                      f.label
                    )}
                  </td>
                  <td>
                    {ed ? (
                      <>
                      <span className="cfg__money">
                        <TextInput id={`vfc-${i}`} aria-label={`${f.label || `Row ${i + 1}`}: currency`} className="cfg__cellinput cfg__code" maxLength={3} value={f.currency} invalid={!!v.err(`vfc-${i}`)} aria-describedby={v.err(`vfc-${i}`) ? `vfc-${i}-error` : undefined} onBlur={v.blur(`vfc-${i}`)} onChange={(e) => upd(i, { currency: e.target.value.toUpperCase() })} />
                        <TextInput id={`vfa-${i}`} aria-label={`${f.label || `Row ${i + 1}`}: amount`} inputMode="numeric" className="cfg__cellinput cfg__num" value={fmt(f.amount)} invalid={!!v.err(`vfa-${i}`)} aria-describedby={v.err(`vfa-${i}`) ? `vfa-${i}-error` : undefined} onBlur={v.blur(`vfa-${i}`)} onChange={(e) => upd(i, { amount: num(e.target.value) })} />
                      </span>
                      <CellError id={`vfc-${i}`}>{v.err(`vfc-${i}`)}</CellError>
                      <CellError id={`vfa-${i}`}>{v.err(`vfa-${i}`)}</CellError>
                      </>
                    ) : (
                      <span className="num">
                        {f.currency} {fmtAmount(f.amount, f.currency)}
                      </span>
                    )}
                  </td>
                  <td>
                    {ed ? (
                      <select id={`vfp-${i}`} aria-label={`${f.label}: how often`} className="cfg__cellinput" value={f.per} onChange={(e) => upd(i, { per: e.target.value as VisaFee['per'] })}>
                        <option value="once">Once</option>
                        <option value="year">Every year</option>
                      </select>
                    ) : f.per === 'year' ? (
                      'Every year'
                    ) : (
                      'Once'
                    )}
                  </td>
                  <td>{ed ? <TextInput id={`vfb-${i}`} aria-label={`${f.label}: where it comes from`} className="cfg__cellinput" value={f.basis} onChange={(e) => upd(i, { basis: e.target.value })} /> : <span className="cfg__muted">{f.basis}</span>}</td>
                  <td className="cfg__muted num">{when(f.updated)}</td>
                  {ed && (
                    <td className="cfg__acts">
                      <button type="button" className="icon-btn" aria-label={`Remove ${f.label || 'this row'}`} onClick={() => d.set((x) => x.filter((_, j) => j !== i))}>
                        <Icon name="close" size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ed && (
          <div className="cfg__addrow">
            <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={() => d.set((l) => [...l, { id: `vf${Date.now()}`, country: '', currency: '', label: '', amount: 0, per: 'once', basis: '', updated: Date.now() }])}>
              Add fee
            </Button>
          </div>
        )}
      </Panel>
      <History log={cfg.log} area="Visa and health fees" />
    </>
  );
}
