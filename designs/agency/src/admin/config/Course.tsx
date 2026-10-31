import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { TextInput } from '../../components/forms';
import { FLAG } from '../../data/courses';
import { PageHead } from '../../institution/records/parts';
import type { Living, Rate } from '../data/config';
import type { ConfigProps } from './ConfigPage';
import { EditBar, History, Panel, useDraft, when } from './parts';

const num = (v: string) => Number(v.replace(/[^\d.]/g, ''));
const fmt = (n: number) => (n ? n.toLocaleString('en-GB', { maximumFractionDigits: 4 }) : '');
const nudge = (v: number, pct: number) => Math.round(v * (1 + (Math.random() * 2 - 1) * pct) * 100) / 100;

/**
 * Currency exchange: what one unit of each destination's currency is in Indian rupees; course search reads a budget
 * in lakhs with these rates. Jovial, 31 Oct: read-only until Edit, kept only on Save; **Get today's rates** fills
 * every rate from the rates service (in the prototype, a small move from the last rate) for you to check and save;
 * more currencies can be added for more destinations.
 */
export function Currency({ cfg, change, say }: ConfigProps) {
  const d = useDraft<Rate[]>(cfg.rates);
  const [fetched, setFetched] = useState<number | null>(null);
  const ed = d.editing;
  const upd = (i: number, p: Partial<Rate>) => d.set((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const fetchRates = () => {
    if (!ed) d.start();
    d.set((l) => l.map((x) => (x.perInr ? { ...x, perInr: nudge(x.perInr, 0.012), updated: Date.now() } : x)));
    setFetched(Date.now());
    say('Today’s rates are filled in. Check them, then Save.');
  };
  const save = () => {
    const bad = d.value.find((x) => !x.code.trim() || !x.perInr);
    if (bad) return say('Every currency needs a code and a rate.');
    const changed = d.value.filter((x) => JSON.stringify(x) !== JSON.stringify(cfg.rates.find((y) => y.code === x.code))).map((x) => `${x.code} ₹${x.perInr}`);
    change('Currency exchange', `Saved ${changed.join(', ') || 'no changes'}${fetched ? ' (rates fetched)' : ''}`, (c) => ({ ...c, rates: d.value.map((x) => ({ ...x, code: x.code.trim().toUpperCase() })) }));
    say('Saved and logged. Course search uses the new rates from now.');
    setFetched(null);
    d.stop();
  };
  return (
    <>
      <PageHead title="Currency exchange" lead="What one unit of each destination’s currency is in Indian rupees. Course search reads a budget in lakhs with these rates.">
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
                    {ed ? <TextInput id={`fxu-${i}`} aria-label={`${r.code}: used for`} className="cfg__cellinput" placeholder="Destinations" value={r.usedFor} onChange={(e) => upd(i, { usedFor: e.target.value })} /> : r.usedFor || '–'}
                  </td>
                  <td>
                    {ed ? (
                      <span className="cfg__money">
                        <span aria-hidden="true">₹</span>
                        <TextInput id={`fx-${i}`} aria-label={`1 ${r.code} in Indian rupees`} inputMode="decimal" className="cfg__cellinput cfg__num" value={fmt(r.perInr)} onChange={(e) => upd(i, { perInr: num(e.target.value), updated: Date.now() })} />
                      </span>
                    ) : (
                      <span className="num">₹{fmt(r.perInr)}</span>
                    )}
                  </td>
                  <td className="cfg__muted num">{when(r.updated)}</td>
                  {ed && (
                    <td className="cfg__acts">
                      <button type="button" className="icon-btn" aria-label={`Remove ${r.code || 'this row'}`} onClick={() => d.set((l) => l.filter((_, j) => j !== i))}>
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
            <Button variant="secondary" size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={() => d.set((l) => [...l, { code: '', name: '', perInr: 0, usedFor: '', updated: Date.now() }])}>
              Add currency
            </Button>
          </div>
        )}
      </Panel>
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
      <PageHead title="Living costs" lead="A year’s living costs in each destination, as its visa rules set them. The course dialog adds this to the first year, all in, for every course there.">
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
