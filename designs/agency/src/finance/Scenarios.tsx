// @ts-nocheck -- reads the commission engine's output; typed with the finance API.
/**
 * Commission scenarios (commissions-26, 2 Nov): the commissions team's sheet, case by case (IP 1–19, RP 1–7 and the
 * combination cases), each with the sheet's wording, the terms set up, the sample students (pseudonyms), the amounts
 * worked out by hand (src/finance/scenarioCases.ts, never by the engine) and the engine's amounts, Pass or Fail. Each
 * case's lines open with How it's worked out. The same cases run in scripts/test-commissions.mjs and in the
 * standalone Commissions Sandbox. Scenario samples are their own small worlds: Finance's own data is untouched.
 */
import { useMemo, useState } from 'react';
import { compute, buildRun, money, nice, LEVELS, traceText } from './engine';
import { SCENARIOS, runAll } from './scenarioCases';
import { Page, Card, Segmented, Table, Pill, Button, LinkButton } from './kit';
import { downloadCsv } from './shared';
import { lineLabel } from './Commissions';

const show = (v) => (v == null ? '—' : typeof v === 'number' ? v.toLocaleString('en-AU', { maximumFractionDigits: 2 }) : Array.isArray(v) ? v.map(show).join(Array.isArray(v[0]) ? ' · ' : ' on ') : String(v));
const TAB = [['all', 'All'], ['IP', 'Institutions (IP)'], ['RP', 'Agents (RP)'], ['Combination', 'Combinations']];

export default function Scenarios() {
  const results = useMemo(() => runAll(compute, buildRun), []);
  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState(null);
  const [how, setHow] = useState(null);
  const pass = results.filter((r) => r.ok).length;
  const checks = results.reduce((t, r) => t + r.checks.length, 0);
  const csv = () => downloadCsv(`commission-scenarios-${new Date().toISOString().slice(0, 10)}.csv`, ['Case', 'Sheet', 'Scenario', 'Check', 'Hand calculation', 'Expected', 'Engine', 'Result', 'Looked at on'],
    results.flatMap((r) => { const c = SCENARIOS.find((x) => x.id === r.id); return r.checks.map((k) => [c.id, c.tab + (c.sheetNo ? ' ' + c.sheetNo : ''), c.title, k.what, k.calc || '', JSON.stringify(k.exp), JSON.stringify(k.got), k.ok ? 'Pass' : 'Fail', k.today]); }));
  return (
    <Page title="Commission scenarios" lead={`Every scenario on the commissions team’s sheet, and the cases where they combine: ${pass} of ${results.length} pass (${results.reduce((t, r) => t + r.checks.filter((k) => k.ok).length, 0)} of ${checks} checks). Expected amounts are worked out by hand; open a case to see each line’s working. Scenario samples only: Finance’s own lines are not touched.`}
      actions={<Button onClick={csv}>Download CSV</Button>}>
      <Segmented label="Show" options={TAB} value={tab} onChange={setTab} />
      {results.filter((r) => tab === 'all' || SCENARIOS.find((x) => x.id === r.id).tab === tab).map((r) => {
        const c = SCENARIOS.find((x) => x.id === r.id);
        const U = Object.fromEntries(c.cfg.unis.map((u) => [u.id, u])), RPS = Object.fromEntries(c.cfg.rps.map((x) => [x.id, x]));
        const res = r.res[c.today];
        return (
          <Card key={c.id} className="gspx-pad">
            <div className="gspx-row"><div className="gspx-grow"><p className="muted">{c.id} · {c.sheetNo ? `Sheet ${c.tab}, ${c.sheetNo}` : 'Combination case'}</p><h3 className="gspx-h3">{c.title}</h3></div>
              <Pill tone={r.ok ? 'dpill--verified' : 'dpill--bad'}>{r.ok ? 'Pass' : 'Fail'}</Pill></div>
            <p className="gspx-sentence">{c.sheet}</p>
            <h4 className="gspx-h4">Terms set up</h4>
            <ul>{c.terms.map((t, i) => <li key={i}>{t}</li>)}</ul>
            <h4 className="gspx-h4">Expected (worked out by hand) and the engine, on {nice(c.today)}</h4>
            <Table head={['Check', 'Hand calculation', 'Expected', 'Engine', 'Result']}>
              {r.checks.map((k, i) => <tr key={i} className="irow"><td>{k.what}{k.today !== c.today && <span className="irow__sub">On {nice(k.today)}</span>}</td><td className="muted">{k.calc || '—'}</td><td className="num">{show(k.exp)}</td><td className="num">{show(k.got)}</td><td><Pill tone={k.ok ? 'dpill--verified' : 'dpill--bad'}>{k.ok ? 'Pass' : 'Fail'}</Pill></td></tr>)}
            </Table>
            <p><LinkButton aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide the case' : 'Open the case: students and lines'}</LinkButton></p>
            {open === c.id && Object.values(c.apps).map((a) => {
              const u = U[a.uni] || {};
              const ip = res.ip.filter((x) => x.app === a.id), rp = res.rp.filter((x) => x.app === a.id);
              return (
                <div key={a.id} className="gspx-case">
                  <h4 className="gspx-h4">{a.student} · {u.name} · {(RPS[a.rp] || {}).name}</h4>
                  <p className="muted">{[LEVELS[a.level] || a.level, a.course, a.campus && a.campus + ' campus', 'from ' + a.nationality, 'intake ' + nice(a.intake), 'final tuition fee ' + money(+a.tuition, u.cur)].filter(Boolean).join(' · ')}</p>
                  <Table head={['Line', 'Date', 'Amount', 'Status', '']}>
                    {ip.flatMap((x) => { const k = 'u' + a.id + x.l.key; return [
                      <tr key={k} className="irow"><td>{lineLabel(x.l)}<span className="irow__sub">University to GSP</span></td><td className="num">{nice(x.l.date)}</td><td className="num">{money(x.l.ent, u.cur)}</td><td>{x.l.st[0]}</td><td><LinkButton aria-expanded={how === k} onClick={() => setHow(how === k ? null : k)}>{how === k ? 'Hide working' : 'How it’s worked out'}</LinkButton></td></tr>,
                      how === k && <tr key={k + 'w'} className="gspx-working"><td colSpan={5}><ol className="gspx-why">{traceText(x.l.trace).map((w, i) => <li key={i}>{w}</li>)}</ol></td></tr>]; })}
                    {rp.flatMap((x) => { const k = 'r' + a.id + x.key; return [
                      <tr key={k} className="irow"><td>{x.label}<span className="irow__sub">GSP to the RP{x.lp != null ? ` · ${x.lp}%` : ''}</span></td><td className="num">—</td><td className="num">{money(x.ent, x.cur)}<span className="irow__sub">due {money(x.due, x.cur)}</span></td><td>{x.st[0]}</td><td><LinkButton aria-expanded={how === k} onClick={() => setHow(how === k ? null : k)}>{how === k ? 'Hide working' : 'How it’s worked out'}</LinkButton></td></tr>,
                      how === k && <tr key={k + 'w'} className="gspx-working"><td colSpan={5}><ol className="gspx-why">{traceText(x.trace).map((w, i) => <li key={i}>{w}</li>)}</ol></td></tr>]; })}
                  </Table>
                </div>
              );
            })}
          </Card>
        );
      })}
    </Page>
  );
}
