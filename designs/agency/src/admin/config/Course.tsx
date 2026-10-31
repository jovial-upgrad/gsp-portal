import { TextInput } from '../../components/forms';
import { FLAG } from '../../data/courses';
import { PageHead } from '../../institution/records/parts';
import type { ConfigProps } from './ConfigPage';
import { History, Panel, when } from './parts';

const num = (v: string) => Number(v.replace(/[^\d.]/g, ''));

/**
 * Currency exchange (not in the PM prototype; course search's sample rates): what one unit of each destination's
 * currency is in Indian rupees. Course search reads a budget typed in lakhs with it, and commission statements
 * convert with it. A rate is changed in place; the change is logged.
 */
export function Currency({ cfg, change, say }: ConfigProps) {
  return (
    <>
      <PageHead title="Currency exchange" lead="What one unit of each destination’s currency is in Indian rupees. Course search reads a budget in lakhs with these rates, and commission statements convert with them." />
      <Panel flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Currency</th>
                <th scope="col">Used for</th>
                <th scope="col">1 unit in INR</th>
                <th scope="col">Last changed</th>
              </tr>
            </thead>
            <tbody>
              {cfg.rates.map((r) => (
                <tr key={r.code}>
                  <td>
                    <span className="cfg__strong">{r.code}</span>
                    <span className="cfg__sub">{r.name}</span>
                  </td>
                  <td className="cfg__muted">{r.usedFor || '–'}</td>
                  <td>
                    <span className="cfg__money">
                      <span aria-hidden="true">₹</span>
                      <TextInput
                        id={`fx-${r.code}`}
                        aria-label={`1 ${r.code} in Indian rupees`}
                        inputMode="decimal"
                        className="cfg__cellinput cfg__num"
                        defaultValue={String(r.perInr)}
                        onBlur={(e) => {
                          const v = num(e.target.value);
                          if (!v || v === r.perInr) return void (e.target.value = String(r.perInr));
                          change('Currency exchange', `${r.code}: ₹${r.perInr} → ₹${v}`, (c) => ({ ...c, rates: c.rates.map((x) => (x.code === r.code ? { ...x, perInr: v, updated: Date.now() } : x)) }));
                          say(`1 ${r.code} = ₹${v}. Saved and logged.`);
                        }}
                      />
                    </span>
                  </td>
                  <td className="cfg__muted num">{when(r.updated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <History log={cfg.log} area="Currency exchange" />
    </>
  );
}

/**
 * Living costs (not in the PM prototype; the visa figures the course dialog uses): a year's living costs for each
 * destination, as its visa rules set them. The course dialog adds it to the first year, all in, for every course
 * there. The figure and where it comes from are changed in place.
 */
export function LivingCosts({ cfg, change, say }: ConfigProps) {
  return (
    <>
      <PageHead title="Living costs" lead="A year’s living costs in each destination, as its visa rules set them. The course dialog adds this to the first year, all in, for every course there." />
      <Panel flush>
        <div className="stab-wrap">
          <table className="itab cfg__tab">
            <thead>
              <tr>
                <th scope="col">Destination</th>
                <th scope="col">A year (visa figure)</th>
                <th scope="col">Where it comes from</th>
                <th scope="col">Last changed</th>
              </tr>
            </thead>
            <tbody>
              {cfg.living.map((l) => (
                <tr key={l.country}>
                  <td className="cfg__strong">
                    <span aria-hidden="true">{FLAG[l.country]}</span> {l.country}
                  </td>
                  <td>
                    <span className="cfg__money">
                      <span>{l.currency}</span>
                      <TextInput
                        id={`lv-${l.country}`}
                        aria-label={`${l.country}: a year’s living costs in ${l.currency}`}
                        inputMode="numeric"
                        className="cfg__cellinput cfg__num"
                        defaultValue={l.perYear.toLocaleString('en-GB')}
                        onBlur={(e) => {
                          const v = num(e.target.value);
                          if (!v || v === l.perYear) return void (e.target.value = l.perYear.toLocaleString('en-GB'));
                          e.target.value = v.toLocaleString('en-GB');
                          change('Living costs', `${l.country}: ${l.currency} ${l.perYear.toLocaleString('en-GB')} → ${l.currency} ${v.toLocaleString('en-GB')}`, (c) => ({ ...c, living: c.living.map((x) => (x.country === l.country ? { ...x, perYear: v, updated: Date.now() } : x)) }));
                          say(`${l.country}: ${l.currency} ${v.toLocaleString('en-GB')} a year. Saved and logged.`);
                        }}
                      />
                    </span>
                  </td>
                  <td>
                    <TextInput
                      id={`lb-${l.country}`}
                      aria-label={`${l.country}: where the figure comes from`}
                      className="cfg__cellinput"
                      defaultValue={l.basis}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (!v || v === l.basis) return void (e.target.value = l.basis);
                        change('Living costs', `${l.country}: source → ${v}`, (c) => ({ ...c, living: c.living.map((x) => (x.country === l.country ? { ...x, basis: v, updated: Date.now() } : x)) }));
                        say('Saved and logged.');
                      }}
                    />
                  </td>
                  <td className="cfg__muted num">{when(l.updated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <History log={cfg.log} area="Living costs" />
    </>
  );
}
