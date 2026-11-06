// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Finance › Exchange rates (Jovial, 6 Nov): Finance's own weekly rates for commissions, separate from Admin's search
 * rates (Admin › Currency exchange). One unit of each currency in AUD, one set per IST week (Monday). A commission line
 * is priced at the rate of the week it's paid; a currency with no rate that week holds its lines. Finance enters this
 * week's or next week's rates (Fetch with AI drafts them) and saves; past weeks are read only. T50 asks on Friday when
 * next week has none; T60 when a currency Finance pays or invoices in has no rate this week.
 */
import React, { useState } from 'react';
import { update } from './store';
import { can } from './access';
import { Page, Card, Select, Table, Button, Notice, NumberInput, toast } from './kit';
import { PersonaBar, usePersona } from './persona';
import { useComm } from './shared';
import { currencyName } from '../admin/data/config';
import { fmtDate } from '../data/format';

const DAY = 864e5;
/** The Monday of the IST week a moment is in. */
const mondayOf = (t) => {
  const d = new Date(new Date(t + 5.5 * 36e5).toISOString().slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const fmt = n => (!(n > 0) ? '' : n < 0.01 ? String(Number(n.toPrecision(3))) : n.toLocaleString('en-GB', { maximumFractionDigits: 4 }));
const ok = v => Number(v) > 0 && !/\.\d{5,}/.test(String(v));

export default function FxRates() {
  const { c, cfg } = useComm();
  const { user, role } = usePersona();
  const canEdit = can(null, role.id, 'comm-terms', 'U');
  const weeks = [...(cfg.settings.fx || [])].sort((a, b) => (a.week < b.week ? -1 : 1));
  const thisWeek = mondayOf(Date.now());
  const nextWeek = mondayOf(Date.now() + 7 * DAY);
  // the currencies Finance pays or invoices in, and any already in its table
  const codes = [...new Set([...weeks.flatMap(w => Object.keys(w).filter(k => k !== 'week')), ...cfg.unis.map(u => u.cur), ...cfg.rps.map(r => r.cur)].filter(Boolean))]
    .sort((a, b) => (a === 'AUD' ? -1 : b === 'AUD' ? 1 : a.localeCompare(b)));
  const options = [...new Set([nextWeek, thisWeek, ...weeks.map(w => w.week).filter(w => w <= thisWeek)])].sort().reverse();
  const [week, setWeek] = useState(thisWeek);
  const editable = canEdit && week >= thisWeek;
  const row = weeks.find(w => w.week === week);
  const before = [...weeks].filter(w => w.week < week).pop();
  const [draft, setDraft] = useState(null);
  const [tried, setTried] = useState(false);
  const value = code => (draft ? draft[code] : row?.[code]) ?? '';
  const start = () => setDraft(Object.fromEntries(codes.map(k => [k, k === 'AUD' ? 1 : row?.[k] ?? before?.[k] ?? ''])));
  const err = code => (code === 'AUD' || !draft ? null : !ok(draft[code]) ? 'Enter a number above 0, with up to 4 decimals.' : null);
  const bad = draft ? codes.filter(err) : [];
  const usedBy = code => {
    const u = cfg.unis.filter(x => x.cur === code).length, r = cfg.rps.filter(x => x.cur === code).length;
    return [u && `${u} universit${u === 1 ? 'y' : 'ies'}`, r && `${r} RP${r === 1 ? '' : 's'}`].filter(Boolean).join(', ') || '—';
  };
  // Fetch with AI drafts every rate from last week's, as a fetch would; nothing is saved until Finance saves
  const fetchAi = () => {
    const base = Object.fromEntries(codes.map(k => [k, k === 'AUD' ? 1 : Number(row?.[k] ?? before?.[k]) || '']));
    setDraft(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, k === 'AUD' || !v ? v : Number((v * (1 + ((k.charCodeAt(0) + k.charCodeAt(2)) % 9 - 4) / 1000)).toPrecision(4))])));
    toast('Rates drafted. Check them, then Save.');
  };
  const save = () => {
    setTried(true);
    if (bad.length) return;
    const saved = { week, ...Object.fromEntries(codes.map(k => [k, Number(draft[k])])) };
    const changed = codes.filter(k => k !== 'AUD' && Number(row?.[k]) !== Number(draft[k])).map(k => `${k} ${fmt(Number(row?.[k])) || 'none'} → ${fmt(Number(draft[k]))}`);
    update(x => {
      const fx = (x.comm.cfg.settings.fx || []).filter(w => w.week !== week);
      x.comm.cfg.settings.fx = [...fx, saved].sort((a, b) => (a.week < b.week ? -1 : 1));
    }, `${user.name} saved exchange rates for the week of ${fmtDate(week)}: ${changed.join(', ') || 'no changes'}`);
    toast('Exchange rates saved');
    setDraft(null); setTried(false);
  };
  const missing = codes.filter(k => k !== 'AUD' && !(Number(row?.[k]) > 0));
  return (
    <Page title="Exchange rates" top={<PersonaBar />}
      lead="Finance’s rates for commissions: one unit of each currency in Australian dollars, one set per week (Monday to Sunday, IST). Each commission line is priced at the rate of the week it’s paid. Course search uses Admin’s search rates, not these."
      actions={editable && <div className="gspx-acts">
        <Button onClick={fetchAi}>Fetch with AI</Button>
        {draft ? <><Button onClick={() => { setDraft(null); setTried(false); }}>Cancel</Button><Button kind="primary" onClick={save}>Save</Button></> : <Button kind="primary" onClick={start}>Edit</Button>}
      </div>}>
      <div className="gspx-stack">
        <Select id="fx-week" label="Week of" value={week} onChange={w => { setWeek(w); setDraft(null); setTried(false); }}
          options={options.map(w => [w, `Week of ${fmtDate(w)}${w === thisWeek ? ' (this week)' : w === nextWeek ? ' (next week)' : ''}`])} />
        {!canEdit && <Notice>Read only. Finance enters these.</Notice>}
        {!row && !draft && <Notice tone="warn">No rates saved for the week of {fmtDate(week)}.{week === thisWeek ? ' Commission lines paid this week are held until they are.' : ''}</Notice>}
        {row && missing.length > 0 && !draft && <Notice tone="warn">No rate for {missing.join(', ')} this week: lines in {missing.length > 1 ? 'these currencies' : 'it'} are held.</Notice>}
        {tried && bad.length > 0 && <Notice tone="bad">Check the rate for {bad.join(', ')}.</Notice>}
        <Card flush>
          <Table head={['Currency', '1 unit in AUD', 'Used by']} className="cfg__tab">
            {codes.map(k => (
              <tr key={k}>
                <td className="cfg__strong">{k}<span className="cfg__sub">{currencyName(k)}</span></td>
                <td>{draft && k !== 'AUD'
                  ? <NumberInput id={`ffx-${k}`} aria-label={`1 ${k} in Australian dollars`} value={draft[k]} error={tried && err(k)} onChange={v => setDraft(d => ({ ...d, [k]: v }))} />
                  : <span className="num">{k === 'AUD' ? '1' : fmt(Number(value(k))) || '–'}</span>}</td>
                <td className="muted">{usedBy(k)}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <p className="muted">If next week has no rates by Friday 01:00 IST, a task goes to the Finance queue (T50). A currency a university or an RP is paid in with no rate this week also makes a task (T60).</p>
      </div>
    </Page>
  );
}
