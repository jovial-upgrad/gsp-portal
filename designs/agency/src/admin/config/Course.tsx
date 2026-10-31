import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { TextInput } from '../../components/forms';
import { FLAG } from '../../data/courses';
import { PageHead } from '../../institution/records/parts';
import { inrPerFrom, type FxWeek, type Living, type Rate, type VisaFee } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { EditBar, History, Panel, useDraft, when } from './parts';

const num = (v: string) => Number(v.replace(/[^\d.]/g, ''));
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
  const d = useDraft<Rate[]>(cfg.rates);
  const [fetched, setFetched] = useState<number | null>(null);
  const ed = d.editing;
  const upd = (i: number, p: Partial<Rate>) => d.set((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const inr = (code: string, rates: Rate[]) => inrPerFrom(rates, code);
  const fetchRates = () => {
    if (!ed) d.start();
    d.set((l) => l.map((x) => (x.aud && x.code !== 'AUD' ? { ...x, aud: nudge4(x.aud, 0.012), updated: Date.now() } : x)));
    setFetched(Date.now());
    say('Today’s rates are filled in. Check them, then Save.');
  };
  const save = () => {
    const bad = d.value.find((x) => !x.code.trim() || !x.aud);
    if (bad) return say('Every currency needs a code and a rate.');
    const rates = d.value.map((x) => ({ ...x, code: x.code.trim().toUpperCase() }));
    const changed = rates.filter((x) => JSON.stringify(x) !== JSON.stringify(cfg.rates.find((y) => y.code === x.code))).map((x) => `${x.code} AUD ${x.aud}`);
    const week = weekStart();
    const row: FxWeek = { week, ...Object.fromEntries(rates.map((x) => [x.code, x.aud])) };
    change('Currency exchange', `Saved ${changed.join(', ') || 'no changes'} for the week of ${week}${fetched ? ' (rates fetched)' : ''}`, (c) => ({
      ...c,
      rates,
      fxWeeks: [...c.fxWeeks.filter((w) => w.week < week), row, ...c.fxWeeks.filter((w) => w.week > week).map((w) => ({ ...w, ...row, week: w.week }))],
    }));
    say('Saved and logged. Course search and Finance use the new rates from now.');
    setFetched(null);
    d.stop();
  };
  return (
    <>
      <PageHead title="Currency exchange" lead="The exchange rates every part of GSP uses: one unit of each currency in Australian dollars. Course search works out its budget in lakhs from these, and Finance prices each commission line at the rate of the week it’s paid.">
        <Button variant="secondary" iconLeft={<Icon name="refresh" size={18} />} onClick={fetchRates}>
          Get today’s rates
        </Button>
        <EditBar editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => { setFetched(null); d.stop(); }} onSave={save} />
      </PageHead>
      {fetched && <p className="cfg__warnbox cfg__editing">Rates fetched {when(fetched)}. Nothing changes until you Save.</p>}
      <Panel flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Currency</th>
                <th scope="col">Used for</th>
                <th scope="col">1 unit in AUD</th>
                <th scope="col">1 unit in INR</th>
                <th scope="col">Last changed</th>
                {ed && <th scope="col"><span className="vh">Remove</span></th>}
              </tr>
            </thead>
            <tbody>
              {d.value.map((r, i) => (
                <tr key={i}>
                  <td>
                    {ed && !cfg.rates.some((x) => x.code === r.code && x.name === r.name) ? (
                      <span className="cfg__pair">
                        <TextInput id={`fxc-${i}`} aria-label="Currency code" className="cfg__cellinput cfg__code" placeholder="Code" maxLength={3} value={r.code} onChange={(e) => upd(i, { code: e.target.value.toUpperCase() })} />
                        <TextInput id={`fxn-${i}`} aria-label="Currency name" className="cfg__cellinput" placeholder="Name" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} />
                      </span>
                    ) : (
                      <>
                        <span className="cfg__strong">{r.code}</span>
                        <span className="cfg__sub">{r.name}</span>
                      </>
                    )}
                  </td>
                  <td className="cfg__muted">
                    {ed ? <TextInput id={`fxu-${i}`} aria-label={`${r.code}: used for`} className="cfg__cellinput" placeholder="Where it’s used" value={r.usedFor} onChange={(e) => upd(i, { usedFor: e.target.value })} /> : r.usedFor || '–'}
                  </td>
                  <td>
                    {ed && r.code !== 'AUD' ? (
                      <TextInput id={`fx-${i}`} aria-label={`1 ${r.code} in Australian dollars`} inputMode="decimal" className="cfg__cellinput cfg__num" value={String(r.aud || '')} onChange={(e) => upd(i, { aud: num(e.target.value), updated: Date.now() })} />
                    ) : (
                      <span className="num">{r.code === 'AUD' ? '1' : fmt(r.aud)}</span>
                    )}
                  </td>
                  <td className="cfg__muted num">{r.code === 'INR' ? '1' : inr(r.code, d.value) ? `₹${fmt(Math.round(inr(r.code, d.value)! * 100) / 100)}` : '–'}</td>
                  <td className="cfg__muted num">{when(r.updated)}</td>
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
            <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={() => d.set((l) => [...l, { code: '', name: '', aud: 0, usedFor: '', updated: Date.now() }])}>
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
  const d = useDraft<Living[]>(cfg.living);
  const [fetched, setFetched] = useState<number | null>(null);
  const ed = d.editing;
  const upd = (i: number, p: Partial<Living>) => d.set((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const fetchFigures = () => {
    if (!ed) d.start();
    d.set((l) => l.map((x) => (x.perYear ? { ...x, updated: Date.now() } : x)));
    setFetched(Date.now());
    say('Checked against each country’s visa rules. Nothing has moved since the last change; Save to record the check.');
  };
  const save = () => {
    if (d.value.some((x) => !x.country.trim() || !x.currency.trim() || !x.perYear)) return say('Every destination needs a name, a currency and a yearly figure.');
    const changed = d.value.filter((x) => JSON.stringify(x) !== JSON.stringify(cfg.living.find((y) => y.country === x.country))).map((x) => `${x.country} ${x.currency} ${x.perYear.toLocaleString('en-GB')}`);
    change('Living costs', `Saved ${changed.join(', ') || 'no changes'}${fetched ? ' (figures checked)' : ''}`, (c) => ({ ...c, living: d.value }));
    say('Saved and logged.');
    setFetched(null);
    d.stop();
  };
  return (
    <>
      <PageHead title="Living costs" lead="A year’s living costs in each destination, as its visa rules set them. The course page shows it under Other costs and adds it to the first year, all in, for every course there.">
        <Button variant="secondary" iconLeft={<Icon name="refresh" size={18} />} onClick={fetchFigures}>
          Get current figures
        </Button>
        <EditBar editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={() => { setFetched(null); d.stop(); }} onSave={save} />
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
                      <TextInput id={`lvn-${i}`} aria-label="Destination" className="cfg__cellinput" placeholder="Destination" value={l.country} onChange={(e) => upd(i, { country: e.target.value })} />
                    ) : (
                      <>
                        <span aria-hidden="true">{FLAG[l.country as keyof typeof FLAG] ?? ''}</span> {l.country}
                      </>
                    )}
                  </td>
                  <td>
                    {ed ? (
                      <span className="cfg__money">
                        <TextInput id={`lvc-${i}`} aria-label={`${l.country}: currency`} className="cfg__cellinput cfg__code" maxLength={3} value={l.currency} onChange={(e) => upd(i, { currency: e.target.value.toUpperCase() })} />
                        <TextInput id={`lv-${i}`} aria-label={`${l.country}: a year’s living costs`} inputMode="numeric" className="cfg__cellinput cfg__num" value={fmt(l.perYear)} onChange={(e) => upd(i, { perYear: num(e.target.value), updated: Date.now() })} />
                      </span>
                    ) : (
                      <span className="num">
                        {l.currency} {l.perYear.toLocaleString('en-GB')}
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
  const d = useDraft<VisaFee[]>(cfg.visaFees);
  const ed = d.editing;
  const upd = (i: number, p: Partial<VisaFee>) => d.set((l) => l.map((x, j) => (j === i ? { ...x, ...p, updated: Date.now() } : x)));
  const save = () => {
    if (d.value.some((x) => !x.country.trim() || !x.currency.trim() || !x.label.trim() || !x.amount)) return say('Every fee needs a destination, a currency, a name and an amount.');
    const changed = d.value.filter((x) => JSON.stringify(x) !== JSON.stringify(cfg.visaFees.find((y) => y.id === x.id))).map((x) => `${x.country} · ${x.label} ${x.currency} ${x.amount.toLocaleString('en-GB')}`);
    change('Visa and health fees', `Saved ${changed.join(', ') || 'no changes'}`, (c) => ({ ...c, visaFees: d.value }));
    say('Saved and logged. Course pages show the new fees from now.');
    d.stop();
  };
  return (
    <>
      <PageHead title="Visa and health fees" lead="What a student pays to study in each destination besides tuition and living costs. The course page lists them under Other costs and adds them to the first year, all in.">
        <EditBar editing={ed} dirty={d.dirty} onEdit={d.start} onCancel={d.stop} onSave={save} />
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
                      <TextInput id={`vfd-${i}`} aria-label="Destination" className="cfg__cellinput" value={f.country} onChange={(e) => upd(i, { country: e.target.value })} />
                    ) : (
                      <>
                        <span aria-hidden="true">{FLAG[f.country as keyof typeof FLAG] ?? ''}</span> {f.country}
                      </>
                    )}
                  </td>
                  <td>{ed ? <TextInput id={`vfl-${i}`} aria-label={`${f.country}: fee`} className="cfg__cellinput" value={f.label} onChange={(e) => upd(i, { label: e.target.value })} /> : f.label}</td>
                  <td>
                    {ed ? (
                      <span className="cfg__money">
                        <TextInput id={`vfc-${i}`} aria-label={`${f.label}: currency`} className="cfg__cellinput cfg__code" maxLength={3} value={f.currency} onChange={(e) => upd(i, { currency: e.target.value.toUpperCase() })} />
                        <TextInput id={`vfa-${i}`} aria-label={`${f.label}: amount`} inputMode="numeric" className="cfg__cellinput cfg__num" value={fmt(f.amount)} onChange={(e) => upd(i, { amount: num(e.target.value) })} />
                      </span>
                    ) : (
                      <span className="num">
                        {f.currency} {f.amount.toLocaleString('en-GB')}
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
