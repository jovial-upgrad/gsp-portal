// @ts-nocheck -- uses the ported commission engine; typed with the finance API.
/**
 * The Commission tab on an application (Jovial, 31 Oct). Internal users see both sides: what the university pays
 * GSP and what GSP pays the RP, line by line, each with how it was worked out. RP Admin sees only the RP's side:
 * its own amounts, its rate and why, never GSP's commission or the university's rate.
 * Worked out live with the commission engine from Finance's terms (finance/store); before the student enrols
 * every line is an estimate.
 */
import { useMemo, useState } from 'react';
import { courseOf, startOf, censusOf, type Application } from '../data/applications';
import { compute, money, nice } from './engine';
import { getState } from './store';
import { UNI_TERMS, rpByName } from '../data/dataset';
import { uniSteps } from './Commissions';
import { convert } from './shared';
import './finance.css';

const LEVEL: Record<string, string> = { Foundation: 'FDN', Diploma: 'DIP', 'Bachelor’s degree': 'UG', 'Postgraduate diploma': 'PG', 'Master’s degree': 'PG', 'PhD or research': 'RES' };
const COUNTRY: Record<string, string> = { Australia: 'AU', UK: 'UK', 'New Zealand': 'NZ', Canada: 'CA', Ireland: 'IE', USA: 'US' };
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const TONE = { 'p-good': 'dpill--verified', 'p-warn': 'dpill--checking', 'p-bad': 'dpill--bad', 'p-acc': '', 'p-mute': '' };

/**
 * The application as the engine sees it. An enrolled one is Finance's own copy (finance/fromDataset.ts), priced with
 * every other enrolment so tiers count the same: the lines here are Finance's lines. Before enrolment it's an
 * estimate from today's terms. The university and the RP are found by id (data/dataset.ts), never by name.
 */
function priced(a: Application, agency: string) {
  const s = getState();
  const cfg = s.comm.cfg;
  const today = s.comm.today;
  const c = courseOf(a);
  const stored = s.comm.apps[a.id];
  const lvl = LEVEL[c.level] ?? 'PG';
  const uniId = UNI_TERMS[c.uni.id];
  let uni = cfg.unis.find((u) => u.id === (stored ? stored.uni : uniId));
  const assumed = !uni;
  const rpId = a.rp ? rpByName(a.rp)?.id : 'R-TEST';
  const rp = cfg.rps.find((r) => r.id === rpId) ?? cfg.rps.find((r) => r.id === 'R-TEST');
  if (stored) {
    const res = compute(cfg, s.comm.apps, today);
    const one = { ...res, ip: res.ip.filter((x) => x.app === a.id), rp: res.rp.filter((x) => x.app === a.id) };
    return { res: one, r: res.apps[a.id], cfg, uni: uni ?? { name: c.uni.name, cur: c.currency, payDays: 30, levels: {}, trigger: 'census' }, rp, assumed, enrolled: true, today };
  }
  const cfg2 = structuredClone(cfg);
  if (!uni) {
    // no terms in Finance for this university: the course record's rate, as an estimate
    uni = { id: `x-${c.uni.id}`, name: c.uni.name, group: '', country: COUNTRY[c.uni.country] ?? 'AU', cur: c.currency, ends: '', trigger: 'census', inst: 2, payDays: 30, cap: null, levels: { [lvl]: c.rate || c.uni.rate }, fixed: {}, tier: null, annuity: null };
    cfg2.unis.push(uni);
  }
  const start = iso(startOf(a));
  const app = { census: iso(censusOf(a)), id: a.id, student: '', rp: rp.id, uni: uni.id, level: lvl, intake: start, tuition: c.tuition, scholarship: c.scholarship, enrolled: start, studentType: 'New', nationality: rp.region, inv: {}, paidIP: {}, paidRP: {} };
  const res = compute(cfg2, { ...s.comm.apps, [a.id]: app }, today);
  const one = { ...res, ip: res.ip.filter((x) => x.app === a.id), rp: res.rp.filter((x) => x.app === a.id) };
  return { res: one, r: res.apps[a.id], cfg: cfg2, uni, rp, assumed, enrolled: false, today };
}

export function AppCommission({ a, agency, side }: { a: Application; agency: string; side: 'both' | 'rp' }) {
  const p = useMemo(() => priced(a, agency), [a.id, a.status, a.intake, a.courseId, agency]);
  const [open, setOpen] = useState<string | null>(null);
  const { res, r, cfg, uni, rp, assumed, enrolled, today } = p;
  const ip = res.ip.filter((x) => !x.l.annuity || side === 'both');
  const rpLines = res.rp;
  const payee = r.payee || rp;
  const cur = payee.cur || 'AUD';
  const inRp = (amt, from) => convert(cfg, amt, from, cur, today) ?? amt;
  const est = !enrolled;
  const stOf = (st) => (est ? ['Estimate', ''] : [st[0], TONE[st[1]]]);

  return (
    <div className="gspx-fin gspx-appcomm">
      {est && <p className="gspx-note">The student hasn’t enrolled yet, so these are estimates from today’s terms. Commission is earned {uni.trigger === 'census' ? 'after the census date' : 'once the student starts and fees are paid'}, and paid to {side === 'rp' ? 'you' : 'the RP'} once the university pays GSP.</p>}
      {uni.sample && side === 'both' && <p className="gspx-note gspx-note--warn">{uni.name}’s terms are sample terms: Finance has no contract on file yet, so the rate is the course record’s ({Object.values(uni.levels)[0]}%).</p>}
      {assumed && side === 'both' && <p className="gspx-note gspx-note--warn">{uni.name} has no terms in Finance yet, so the course record’s rate ({Object.values(uni.levels)[0]}%) is used. Finance adds the terms from the contract.</p>}

      {side === 'both' && (
        <section className="card cfg__panel is-flush">
          <div className="gspx-pad">
            <h3 className="gspx-h3">From the university to GSP</h3>
            <p className="muted">{uni.name} · {uni.cur} · pays {uni.payDays} days after an invoice</p>
          </div>
          <div className="stab-wrap">
            <table className="itab">
              <thead><tr><th scope="col">Line</th><th scope="col">Due</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col"><span className="vh">Working</span></th></tr></thead>
              <tbody>
                {ip.map((x) => { const k = 'u' + x.l.key; const [t, tone] = stOf(x.l.st); return [
                  <tr key={k} className="irow">
                    <td>{x.l.bonus ? 'University bonus' : x.l.annuity ? `Annuity, year ${x.l.y}` : `Instalment ${x.l.k}${x.l.n > 1 ? ` of ${x.l.n}` : ''}`}<span className="irow__sub">{x.l.fixed != null ? 'Fixed fee' : x.l.pct != null ? `${x.l.pct}% of net tuition` : 'No rate'}</span></td>
                    <td className="num">{nice(x.l.date)}</td>
                    <td className="num">{money(x.l.ent, uni.cur)}{x.l.gst ? <span className="irow__sub">+ GST {money(x.l.gst, uni.cur)}</span> : null}</td>
                    <td><span className={`dpill ${tone}`}>{t}</span></td>
                    <td><button type="button" className="btn btn--link gspx-link" aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)}>{open === k ? 'Hide working' : 'How it’s worked out'}</button></td>
                  </tr>,
                  open === k && <tr key={k + 'w'} className="gspx-working"><td colSpan={5}><ol className="gspx-why">{uniSteps({ ...x, a: { ...x.a, student: '' } }, r, cfg).map((w, i) => <li key={i}>{w}</li>)}</ol></td></tr>,
                ]; })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card cfg__panel is-flush">
        <div className="gspx-pad">
          <h3 className="gspx-h3">{side === 'rp' ? 'Your commission' : `From GSP to the RP · ${payee.name}`}</h3>
          <p className="muted">{side === 'rp' ? `Paid on the weekly payout day in ${cur}, once the university has paid GSP.` : payee.id !== rp.id ? `Paid to the Master Partner for ${rp.name}.` : `${rp.region} · paid in ${payee.cur}`}</p>
        </div>
        <div className="stab-wrap">
          <table className="itab">
            <thead><tr><th scope="col">Payment</th><th scope="col">{side === 'rp' ? 'Your rate' : 'RP rate'}</th><th scope="col">Amount{side === 'rp' ? ` (${cur})` : ''}</th><th scope="col">Status</th><th scope="col"><span className="vh">Working</span></th></tr></thead>
            <tbody>
              {rpLines.map((x) => { const k = 'r' + x.key; const [t, tone] = stOf(x.st); const amt = side === 'rp' ? inRp(x.ent, x.cur) : x.ent; return [
                <tr key={k} className="irow">
                  <td>{x.label.replace('Commission, instalment', 'Instalment')}{x.ip && <span className="irow__sub">After {nice(x.ip.date)}</span>}</td>
                  <td className="num">{x.kind === 'pct' ? (x.lp == null ? '—' : `${x.lp}%`) : 'Fixed'}</td>
                  <td className="num">{money(amt, side === 'rp' ? cur : x.cur)}{x.paid ? <span className="irow__sub">Paid {money(side === 'rp' ? inRp(x.paid, x.cur) : x.paid, side === 'rp' ? cur : x.cur)}</span> : null}</td>
                  <td><span className={`dpill ${tone}`}>{t}</span></td>
                  <td><button type="button" className="btn btn--link gspx-link" aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)}>{open === k ? 'Hide working' : 'How it’s worked out'}</button></td>
                </tr>,
                open === k && (
                  <tr key={k + 'w'} className="gspx-working"><td colSpan={5}>
                    <ol className="gspx-why">
                      {(x.why || [...(r.rpWhy || []), ...(x.annuity ? [r.annWhy] : [])]).map((w, i) => <li key={i}>{w}</li>)}
                      {side === 'both' && x.ip && <li>GSP’s commission on this line is {money(x.ip.ent, uni.cur)}; {x.lp}% of it is {money(x.ent, x.cur)}.</li>}
                      {side === 'rp' && x.cur !== cur && <li>Shown in {cur} at this week’s rate; the exact amount is fixed on the payout day.</li>}
                    </ol>
                  </td></tr>
                ),
              ]; })}
            </tbody>
          </table>
        </div>
      </section>
      {side === 'both' && <p className="muted">{est ? 'Estimated' : 'Worked out'} {nice(today)} from Finance’s terms. Change them in GSP · Finance › Setup › Commission terms.</p>}
    </div>
  );
}
