// @ts-nocheck -- uses the ported commission engine; typed with the finance API.
/**
 * The Commission tab on an application (Jovial, 31 Oct). Internal users see both sides: what the university pays
 * GSP and what GSP pays the RP, line by line, each with how it was worked out. RP Admin sees only the RP's side:
 * its own amounts, its rate and why, never GSP's commission or the university's rate.
 * Worked out live with the commission engine from Finance's terms (finance/store); before the student enrols
 * every line is an estimate.
 */
import { useMemo, useState } from 'react';
import { courseOf, intakeStart, type Application } from '../data/applications';
import { compute, money, nice } from './engine';
import { getState } from './store';
import { uniSteps } from './Commissions';
import { convert } from './shared';
import './finance.css';

const LEVEL: Record<string, string> = { Foundation: 'FDN', Diploma: 'DIP', 'Bachelor’s degree': 'UG', 'Postgraduate diploma': 'PG', 'Master’s degree': 'PG', 'PhD or research': 'RES' };
const COUNTRY: Record<string, string> = { Australia: 'AU', UK: 'UK', 'New Zealand': 'NZ', Canada: 'CA', Ireland: 'IE', USA: 'US' };
const norm = (x: string) => x.toLowerCase().replace(/^the /, '').replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => iso(new Date(d + 'T00:00:00Z').getTime() + n * 864e5);
const TONE = { 'p-good': 'dpill--verified', 'p-warn': 'dpill--checking', 'p-bad': 'dpill--bad', 'p-acc': '', 'p-mute': '' };

/** The application as the engine sees it, with the university's and the RP's terms from Finance. */
function priced(a: Application, agency: string) {
  const c = courseOf(a);
  const cfg = structuredClone(getState().comm.cfg);
  let uni = cfg.unis.find((u) => norm(u.name) === norm(c.uni.name) || norm(u.name).startsWith(norm(c.uni.name)) || norm(c.uni.name).startsWith(norm(u.name)));
  const lvl = LEVEL[c.level] ?? 'PG';
  let assumed = false;
  if (!uni) {
    // not in Finance's terms yet: the course record's rate, as an estimate
    assumed = true;
    uni = { id: `x-${c.uni.id}`, name: c.uni.name, group: '', country: COUNTRY[c.uni.country] ?? 'AU', cur: c.currency, ends: '', trigger: 'census', inst: 2, payDays: 30, cap: null, levels: { [lvl]: c.uni.rate }, fixed: {}, tier: null, annuity: null };
    cfg.unis.push(uni);
  }
  const rp = cfg.rps.find((r) => norm(r.name) === norm(a.rp || agency)) ?? cfg.rps.find((r) => r.id === 'R-TEST');
  const today = iso(Date.now());
  const start = iso(intakeStart(a.intake));
  const enrolled = a.status === 'enrolled';
  const app = { id: a.id, student: '', rp: rp.id, uni: uni.id, level: lvl, intake: start, tuition: c.tuition, scholarship: c.scholarship, enrolled: start, studentType: 'New', nationality: rp.region, inv: {}, paidIP: {}, paidRP: {} };
  let res = compute(cfg, { [a.id]: app }, today);
  if (enrolled) {
    res.apps[a.id].lines.forEach((l) => {
      const paidOn = addDays(l.date, 30);
      if (paidOn <= today) { app.inv[l.key] = l.date; app.paidIP[l.key] = { date: paidOn, amt: l.ent }; }
    });
    res = compute(cfg, { [a.id]: app }, today);
    res.rp.forEach((x) => { if (x.ip && x.ip.paid && addDays(x.ip.paid.date, 14) <= today) app.paidRP[x.key] = x.ent; });
    res = compute(cfg, { [a.id]: app }, today);
  }
  return { res, r: res.apps[a.id], cfg, uni, rp, assumed, enrolled, today };
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
