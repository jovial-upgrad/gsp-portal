// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Commissions (GSP side): Finance's workspace.
 * Overview · University side (invoices and receipts) · RP side (what each RP is owed and why)
 * · Payout run (Thursday, maker-checker, RCTI invoices) · Exceptions · Terms · Processes.
 * Tabs follow the role's access: comm-lines, invoices, payouts, comm-terms.
 */
import React, { useContext, useMemo, useState } from 'react';
import { update, nameOf, getState } from './store';
import { can, inScope } from './access';
import { Page, Card, Tiles, Segmented, Tabs, Select, Table, Pill, Button, LinkButton, Sheet, Empty, Notice, Field, Input, toast } from './kit';
import { useCheck, numError } from '../components/validate';
import { PersonaBar, usePersona, HostContext } from './persona';
import { addDays, addMonths, nice, money, r2, LEVELS, thursdayOf } from './engine';
import { useComm, liveRun, TONE, aud, sum, opsOf, nav, downloadCsv } from './shared';
import Payout from './Payout';
import Terms from './Terms';
import COMM from './comm.json';

/* In the Finance role each view is its own menu item; elsewhere they are tabs on one page. */
const VIEW = {
  uni: ['University invoices', 'What each university owes GSP: raise invoices when the trigger date passes, record payments, chase overdue ones.', 'gspx-fin-uni'],
  rp: ['RP commission', 'What GSP owes each RP, line by line, and how each amount was worked out.', 'gspx-fin-rp'],
  payout: ['Payout run', 'Every pay day: prepare, the RPs approve their invoices, a second person approves payment.', 'gspx-fin-run'],
  exceptions: ['Exceptions', 'Anything that stops a line being priced or paid, and who fixes it.', 'gspx-fin-exc'],
  terms: ['Commission terms', 'Universities, RP terms, schemes, notices, defaults and FX. Every change is checked by a second person.', 'gspx-fin-terms'],
  reports: ['Reports', 'Receipts, what’s outstanding and what’s owed, for month-end and Xero reconciliation.', 'gspx-fin-reports'],
  processes: ['How Finance works', 'What Finance does to keep commissions automatic.', 'gspx-fin-how'],
};

export default function Commissions({ view }) {
  const { s, c, res } = useComm();
  const { user, role } = usePersona();
  const { openPage } = useContext(HostContext);
  const [tabState, setTab] = useState('overview');
  const tab = view || tabState;
  const [filter, setFilter] = useState(() => { const f = nav.filter; nav.filter = null; return f; });
  const m = s.matrix, r = role.id;
  const allow = {
    overview: can(m, r, 'comm-lines'), uni: can(m, r, 'invoices'), rp: can(m, r, 'comm-lines'),
    payout: can(m, r, 'payouts'), exceptions: can(m, r, 'comm-lines'), terms: can(m, r, 'comm-terms'), reports: can(m, r, 'comm-lines'), processes: can(m, r, 'comm-terms'),
  };
  const finance = r === 'finance' || r === 'admin';

  if (!allow.overview && !allow.terms) {
    const fin = s.users.find(u => u.role === 'finance');
    return (
      <Page title="Commissions" top={<PersonaBar />} lead="Commission terms, university invoices, RP payouts.">
        <Card><Empty title={`${role.name} has no access to commissions`}>Access is set in Roles and access. To see this page as Finance, act as {fin.name}.</Empty>
          <div><Button kind="primary" onClick={() => update(d => { d.persona = fin.id; })}>Act as {fin.name} (Finance)</Button></div></Card>
      </Page>
    );
  }

  /* Data scope: regional roles see only lines for RPs in their regions. */
  const scoped = x => inScope(user, { region: (x.r && x.r.rp && x.r.rp.region) || undefined }, s.roles);
  const rpLines = res.rp.filter(scoped);
  const ipLines = res.ip.filter(x => scoped({ r: res.apps[x.app] }));
  const run = liveRun(c, res);
  const pendingChecks = c.checks.filter(k => k.status === 'waiting');

  const tabs = [['overview', 'Overview'], ['uni', 'University side'], ['rp', 'RP side'], ['payout', 'Payout run'], ['exceptions', `Exceptions (${res.exc.length})`], ['terms', `Terms${pendingChecks.length ? ` (${pendingChecks.length} to check)` : ''}`], ['reports', 'Reports'], ['processes', 'Finance processes']]
    .filter(([k]) => allow[k]);
  const go = (t, f = null) => { if (view && VIEW[t] && openPage) { nav.filter = f; openPage(VIEW[t][2]); return; } setTab(t); setFilter(f); };
  const head = view ? VIEW[view] : ['Commissions', 'What universities owe GSP, what GSP owes each RP, and why. Amounts are worked out from the terms; Finance enters terms once and runs the weekly jobs.'];

  return (
    <Page title={head[0]} top={<PersonaBar />} lead={head[1]}
      actions={<DemoClock c={c} canMove={finance} />}>
      {!finance && <Notice>{role.name} can read commissions{role.scope === 'regions' ? ` for ${(user.regions || []).join(', ')}` : ''} but not change them.</Notice>}
      {!view && <Tabs label="Commission views" options={tabs} value={tab} onChange={v => go(v)} />}
      {view && !allow[view] && <Card><Empty title={`${role.name} can’t see this`}>Access is set in Roles and access.</Empty></Card>}
      {tab === 'overview' && <Overview c={c} res={res} rpLines={rpLines} ipLines={ipLines} run={run} checks={pendingChecks} go={go} allow={allow} />}
      {tab === 'uni' && <UniSide res={res} c={c} lines={ipLines} filter={filter} setFilter={setFilter} canEdit={can(m, r, 'invoices', 'U')} user={user} />}
      {tab === 'rp' && <RpSide c={c} lines={rpLines} filter={filter} setFilter={setFilter} canEdit={can(m, r, 'comm-lines', 'U')} user={user} />}
      {tab === 'payout' && <Payout c={c} res={res} run={run} user={user} canPrepare={can(m, r, 'payouts', 'C')} canApprove={can(m, r, 'payouts', 'U')} />}
      {tab === 'exceptions' && <Exceptions c={c} res={res} go={go} user={user} canEdit={finance} />}
      {tab === 'terms' && <Terms c={c} user={user} canEdit={can(m, r, 'comm-terms', 'U')} />}
      {tab === 'reports' && <Reports c={c} res={res} rpLines={rpLines} ipLines={ipLines} />}
      {tab === 'processes' && <Processes go={go} />}
    </Page>
  );
}

const TODAY = new Date().toISOString().slice(0, 10);
/* The commission clock. In the demo Finance can move time to see lines fall due. */
function DemoClock({ c, canMove }) {
  const set = d => update(x => { x.comm.today = d; }, `Commission demo date set to ${nice(d)}`);
  return (
    <div className="gspx-clock">
      <span className="muted">Demo date</span> <b className="num">{nice(c.today)}</b>
      {canMove && <><Button size="sm" onClick={() => set(addDays(c.today, 7))}>+1 week</Button><Button size="sm" onClick={() => set(addMonths(c.today, 1))}>+1 month</Button>
        {c.today !== TODAY && <LinkButton onClick={() => set(TODAY)}>Back to today</LinkButton>}</>}
    </div>
  );
}

function Overview({ c, res, rpLines, ipLines, run, checks, go, allow }) {
  const st = (l, k) => l.st[0] === k;
  const ready = ipLines.filter(x => st(x.l, 'Ready to invoice'));
  const overdue = ipLines.filter(x => st(x.l, 'Payment overdue'));
  const invoiced = ipLines.filter(x => st(x.l, 'Invoiced'));
  const payable = rpLines.filter(x => x.payable && x.due > 0);
  const recover = rpLines.filter(x => x.due < 0);
  const waitUni = rpLines.filter(x => x.st[0] === 'Waiting for university payment');
  const runTotal = sum(run.lines, L => L.aud);
  const tiles = [
    allow.uni && { id: 'uni:Ready to invoice', n: ready.length, label: 'Ready to invoice', sub: aud(sum(ready, x => x.l.aud)), tone: 'you' },
    allow.uni && { id: 'uni:Payment overdue', n: overdue.length, label: 'University payment overdue', sub: aud(sum(overdue, x => x.l.dueAud)), tone: 'bad' },
    { id: 'rp:Ready', n: payable.length, label: 'RP lines ready to pay', sub: aud(sum(payable, x => x.audDue)), tone: 'gsp' },
    { id: 'rp:Recover', n: recover.length, label: 'To recover from RPs', sub: aud(-sum(recover, x => x.audDue)), tone: 'bad' },
  ].filter(Boolean);
  return (
    <>
      <Tiles items={tiles} value={null} onChange={v => { if (!v) return; const [t, f] = v.split(':'); go(t, f); }} />
      <div className="gspx-grid2">
        {allow.payout && <Card>
          <h2 className="gspx-h3">Payout run · Thursday {nice(run.date)}</h2>
          <p><span className="num">{Object.keys(run.payees).length}</span> RPs, <span className="num">{run.lines.length}</span> lines, about <b className="num">{aud(runTotal)}</b>.</p>
          {run.hold.length > 0 && <Notice tone="warn">On hold until this week’s rate is entered: {run.hold.join(', ')}.</Notice>}
          <p className="muted">{run.status === 'draft' ? 'Not prepared yet.' : run.status === 'prepared' ? `Prepared by ${run.preparedBy ? 'Finance' : '—'}; waiting for RPs to approve their invoices and a second person to approve.` : ''}</p>
          <div><Button kind="primary" onClick={() => go('payout')}>Open the payout run</Button></div>
        </Card>}
        <Card>
          <h2 className="gspx-h3">Needs attention</h2>
          <ul className="gspx-list">
            <li><span className="num">{res.exc.length}</span> exceptions <LinkButton onClick={() => go('exceptions')}>Open</LinkButton></li>
            {allow.terms && <li><span className="num">{checks.length}</span> changes waiting for a second person <LinkButton onClick={() => go('terms')}>Open</LinkButton></li>}
            {allow.uni && <li><span className="num">{invoiced.length}</span> invoices waiting for payment ({aud(sum(invoiced, x => x.l.dueAud))})</li>}
            <li><span className="num">{waitUni.length}</span> RP lines waiting for the university to pay GSP</li>
          </ul>
        </Card>
        <Card>
          <h2 className="gspx-h3">Annuity (year 2 onwards)</h2>
          <p className="muted">Commission universities keep paying for continuing students, and the RP’s share of it.</p>
          <AnnuitySummary ipLines={ipLines} rpLines={rpLines} />
        </Card>
      </div>
    </>
  );
}

function AnnuitySummary({ ipLines, rpLines }) {
  const ip = ipLines.filter(x => x.l.annuity), rp = rpLines.filter(x => x.annuity);
  if (!ip.length) return <p>No annuity lines yet.</p>;
  return (
    <ul className="gspx-list">
      <li>GSP: <b className="num">{aud(sum(ip, x => x.l.aud))}</b> across {ip.length} periods, {aud(sum(ip.filter(x => x.l.paid), x => x.l.aud))} received</li>
      <li>RPs’ share: <b className="num">{aud(sum(rp, x => x.audEnt))}</b>, {aud(sum(rp.filter(x => x.paid), x => x.audEnt))} paid</li>
    </ul>
  );
}

/* ---------- University side ---------- */
const UNI_F = [['', 'All'], ['Ready to invoice', 'Ready to invoice'], ['Invoiced', 'Invoiced'], ['Payment overdue', 'Overdue'], ['Paid', 'Paid'], ['Not yet due', 'Not yet due'], ['Held', 'Held or recovering']];
function UniSide({ res, c, lines, filter, setFilter, canEdit, user }) {
  const [q, setQ] = useState('');
  const [why, setWhy] = useState(null);
  const f = filter || '';
  let rows = lines.filter(x => !f || (f === 'Held' ? /^Held|recovers|Not payable/.test(x.l.st[0]) : x.l.st[0] === f));
  if (q) rows = rows.filter(x => (x.a.student + x.u.name + x.app).toLowerCase().includes(q.toLowerCase()));
  const invoice = x => update(d => { const a = d.comm.apps[x.app]; a.inv = { ...(a.inv || {}), [x.l.key]: d.comm.today }; }, `${user.name} raised an invoice to ${x.u.name} for ${x.a.student}`) || toast('Invoice raised. In the live system it is created and sent from Xero.');
  const pay = x => update(d => { const a = d.comm.apps[x.app]; a.paidIP = { ...(a.paidIP || {}), [x.l.key]: { date: d.comm.today, amt: x.l.ent } }; }, `${user.name} recorded ${money(x.l.ent, x.u.cur)} from ${x.u.name} for ${x.a.student}`) || toast('Payment recorded. The RP’s share is now ready for the next payout run.');
  return (
    <Card flush>
      <div className="stools"><div className="stools__row">
        <Segmented label="Status" options={UNI_F} value={f} onChange={setFilter} />
        <div className="gspx-grow" />
        <Input id="uni-q" value={q} onChange={setQ} placeholder="Search student or university" aria-label="Search" />
      </div><p className="stools__count"><span><span className="num">{rows.length}</span> lines · {aud(sum(rows, x => x.l.aud))}</span></p></div>
      <Table head={['Student', 'University', 'Line', 'Trigger date', 'Amount', 'Status', '']}
        empty={!rows.length && <Empty title="No lines here" />}>
        {rows.map(x => (
          <tr key={x.app + x.l.key} className="irow">
            <td>{x.a.student}<span className="irow__sub">{x.app} · {LEVELS[x.a.level] || x.a.level}</span></td>
            <td>{x.u.name}<span className="irow__sub">{x.u.country} · pays in {x.u.payDays} days</span></td>
            <td>{x.l.bonus ? 'University bonus' : x.l.annuity ? `Annuity, year ${x.l.y}${x.l.n > 1 ? `, period ${x.l.p}` : ''}` : `Instalment ${x.l.k}${x.l.n > 1 ? ` of ${x.l.n}` : ''}`}<span className="irow__sub">{x.l.fixed != null ? 'Fixed fee' : x.l.pct != null ? `${x.l.pct}% of tuition${x.l.n > 1 ? ` ÷ ${x.l.n}` : ''}` : 'No rate'}</span></td>
            <td className="num">{nice(x.l.date)}</td>
            <td className="num">{money(x.l.ent, x.u.cur)}{x.l.gst ? <span className="irow__sub">+ GST {money(x.l.gst, x.u.cur)}</span> : null}</td>
            <td><Pill tone={TONE[x.l.st[1]]}>{x.l.st[0]}</Pill>{x.l.st[2] && <span className="irow__sub">{x.l.st[2]}</span>}</td>
            <td><div className="gspx-acts">
              {canEdit && x.l.st[0] === 'Ready to invoice' && <Button size="sm" onClick={() => invoice(x)}>Raise invoice</Button>}
              {canEdit && /Invoiced|overdue/.test(x.l.st[0]) && <Button size="sm" onClick={() => pay(x)}>Record payment</Button>}
              <LinkButton onClick={() => setWhy(x)}>How it’s worked out</LinkButton>
            </div></td>
          </tr>))}
      </Table>
      {why && <UniWhy x={why} r={res.apps[why.app]} cfg={c.cfg} onClose={() => setWhy(null)} />}
    </Card>
  );
}

/* How a university line was worked out (Jovial, 31 Oct): every step from the contract to the amount. */
export function UniWhy({ x, r, cfg, onClose }) {
  const { a, u, l } = x;
  const net = Math.max(0, (+a.tuition || 0) - (+a.scholarship || 0));
  const steps = uniSteps(x, r, cfg);
  return (
    <Sheet title={`${a.student} · ${l.bonus ? 'University bonus' : l.annuity ? `Annuity, year ${l.y}` : `Instalment ${l.k}${l.n > 1 ? ` of ${l.n}` : ''}`}`} sub={`${u.name} · ${a.app || x.app}`} onClose={onClose} wide footer={<Button onClick={onClose}>Close</Button>}>
      <ol className="gspx-why">{steps.map((w, i) => <li key={i}>{w}</li>)}</ol>
      <div className="gspx-sentence">GSP’s commission on this line: <b>{money(l.ent, u.cur)}</b>{l.gst ? ` + GST ${money(l.gst, u.cur)}` : ''}{l.aud != null && u.cur !== 'AUD' ? ` (AUD ${money(l.aud)})` : ''}. Status: {l.st[0].toLowerCase()}{l.st[2] ? `. ${l.st[2]}` : ''}.</div>
      {u.contract && <><h3 className="gspx-h4">What the contract says</h3><dl className="gspx-dl"><dt>Rate</dt><dd>{u.contract.rate}</dd><dt>Trigger</dt><dd>{u.contract.trigger}</dd><dt>Clawback</dt><dd>{u.contract.claw}</dd><dt>Source</dt><dd>{u.contract.src}</dd></dl></>}
      <p className="muted">Net tuition used: {money(net, u.cur)}.</p>
    </Sheet>
  );
}

export function uniSteps(x, r, cfg) {
  const { a, u, l } = x;
  const net = Math.max(0, (+a.tuition || 0) - (+a.scholarship || 0));
  const out = [];
  out.push(`Tuition ${money(+a.tuition || 0, u.cur)} a year${+a.scholarship ? `, less a scholarship of ${money(+a.scholarship, u.cur)}` : ''}: ${money(net, u.cur)}.`);
  if (l.bonus) out.push(`A fixed bonus from ${u.name}’s tier: ${money(l.amt, u.cur)}.`);
  else if (l.fixed != null) out.push(`${u.name} pays a fixed fee for ${LEVELS[a.level] || a.level}: ${money(l.fixed, u.cur)}.`);
  else if (l.pct == null) out.push(`${u.name} has no rate for ${LEVELS[a.level] || a.level}, so this line can’t be priced yet.`);
  else {
    out.push(r && r.uniTier ? `${u.name}’s tier: this is enrolment ${r.uniTier.rank} of ${r.uniTier.total} in the period (${r.uniTier.retro ? 'retrospective: the band reached applies to all' : 'prospective'}), band ${r.uniTier.band.i + 1} → ${l.pct}%.` : `${u.name} pays ${l.pct}% for ${LEVELS[a.level] || a.level}.`);
    out.push(l.annuity ? `Annuity: the university pays again for year ${l.y} of the course${l.n > 1 ? `, in ${l.n} periods` : ''}.` : l.n > 1 ? `The first year is paid in ${l.n} instalments, so each is ${money(net, u.cur)} ÷ ${l.n} × ${l.pct}% = ${money(Math.round((net / l.n) * l.pct) / 100, u.cur)}.` : `${money(net, u.cur)} × ${l.pct}% = ${money(Math.round(net * l.pct) / 100, u.cur)}.`);
    if (r && r.capped && !l.annuity) out.push(`${u.name} caps the first year at ${money(u.cap, u.cur)}, so every first-year line is scaled down to fit.`);
  }
  out.push(`${r ? r.trigWhy : ''}${l.k > 1 && !l.bonus ? `; instalment ${l.k} falls due on ${nice(l.date)}` : ''}.`);
  if (l.cancelled) out.push(`The student withdrew on ${nice(a.withdrawn.date)}, before this line’s date, so nothing is payable.`);
  else if (l.refunded) out.push(`The student withdrew on ${nice(a.withdrawn.date)} with a refund, after this line’s date: the university takes its commission back.`);
  if (l.held) out.push(`Held: ${l.held.toLowerCase()}.`);
  if (l.gst) out.push(`GST ${cfg.settings.auGst}% is added because ${u.name} is in Australia.`);
  if (u.cur !== 'AUD' && l.fx) out.push(`In AUD at this week’s rate (${l.fx} AUD per ${u.cur}).`);
  return out;
}

/* ---------- RP side ---------- */
const RP_F = [['', 'All'], ['Ready', 'Ready to pay'], ['Waiting', 'Waiting for university'], ['Recover', 'To recover'], ['Paid', 'Paid']];
const rpMatch = (x, f) => !f || (f === 'Ready' ? x.payable && x.due > 0 : f === 'Waiting' ? x.st[0] === 'Waiting for university payment' : f === 'Recover' ? x.due < 0 : x.st[0] === 'Paid');
function RpSide({ c, lines, filter, setFilter, canEdit, user }) {
  const [rp, setRp] = useState('');
  const [why, setWhy] = useState(null);
  const f = filter || '';
  const payees = [...new Map(lines.map(x => { const p = x.r.payee || x.r.rp; return [p.id, p.name]; })).entries()].sort((a, b) => a[1] < b[1] ? -1 : 1);
  const rows = lines.filter(x => rpMatch(x, f) && (!rp || (x.r.payee || x.r.rp).id === rp));
  return (
    <Card flush>
      <div className="stools"><div className="stools__row">
        <Segmented label="Status" options={RP_F} value={f} onChange={setFilter} />
        <div className="gspx-grow" />
        <Select id="rp-f" label="RP" hideLabel value={rp} onChange={setRp} placeholder="All RPs" options={payees} />
      </div><p className="stools__count"><span><span className="num">{rows.length}</span> lines · due {aud(sum(rows, x => x.audDue))}</span></p></div>
      <Table head={['Student', 'RP', 'Line', 'Amount', 'Status', '']}
        empty={!rows.length && <Empty title="No lines here" />}>
        {rows.map(x => { const p = x.r.payee || x.r.rp; return (
          <tr key={x.app + x.key} className="irow">
            <td>{x.a.student}<span className="irow__sub">{x.app} · {x.r.u.name}</span></td>
            <td><span className="gspx-wrap">{p.name}</span><span className="irow__sub">{p.id !== x.r.rp.id ? `Master Partner, for ${x.r.rp.name}` : p.region}</span></td>
            <td><span className="gspx-wrap">{x.label}</span><span className="irow__sub">{x.kind === 'pct' ? (x.lp == null ? 'No rate' : `${x.lp}% of GSP’s commission`) : 'Fixed amount'}{x.ov ? ' · overridden' : ''}</span></td>
            <td className="num">{money(x.ent, x.cur)}<span className="irow__sub">{x.paid ? `Paid ${money(x.paid, x.cur)} · ` : ''}{x.due < 0 ? `recover ${money(-x.due, x.cur)}` : `due ${money(x.due, x.cur)}`}</span></td>
            <td><Pill tone={TONE[x.st[1]]}>{x.st[0]}</Pill></td>
            <td><LinkButton onClick={() => setWhy(x)}>How it’s worked out</LinkButton></td>
          </tr>); })}
      </Table>
      {why && <WhySheet x={why} canEdit={canEdit} user={user} onClose={() => setWhy(null)} />}
    </Card>
  );
}

function WhySheet({ x, canEdit, user, onClose }) {
  const [ov, setOv] = useState(x.ov ? x.ov.amt : '');
  const why = x.why || [...(x.r.rpWhy || []), ...(x.annuity ? [x.r.annWhy] : [])];
  const was = x.ov ? x.ov.amt : '';
  const v = useCheck({ ov: numError(ov, { what: 'RP’s amount', min: 0, required: true }) });
  const save = clear => {
    if (!clear && !v.submit()) return;
    update(d => { const a = d.comm.apps[x.app]; a.override = { ...(a.override || {}) }; if (clear) delete a.override[x.key]; else a.override[x.key] = { amt: Number(ov), by: user.id, at: Date.now() }; },
      clear ? `${user.name} removed the override on ${x.a.student} (${x.label})` : `${user.name} overrode ${x.a.student} (${x.label}) to ${money(Number(ov), x.cur)}`);
    toast(clear ? 'Override removed' : 'Override saved', { text: 'Logged with your name.' }); onClose();
  };
  return (
    <Sheet title={`${x.a.student} · ${x.label}`} sub={`${x.r.u.name} · ${(x.r.payee || x.r.rp).name}`} onClose={onClose} wide dirty={String(ov) !== String(was)} what="the override"
      footer={<Button onClick={onClose}>Close</Button>}>
      {x.ip && <div className="gspx-sentence">GSP’s commission on this line: <b>{money(x.ip.ent, x.r.u.cur)}</b> ({x.ip.st[0].toLowerCase()}). {x.r.trigWhy}.</div>}
      <ol className="gspx-why">{why.map((w, i) => <li key={i}>{w}</li>)}</ol>
      <div className="gspx-sentence">RP’s amount: <b>{money(x.ent, x.cur)}</b>. Paid so far {money(x.paid || 0, x.cur)}. {x.due < 0 ? `To recover: ${money(-x.due, x.cur)}, taken from the RP’s next payouts.` : `Due: ${money(x.due, x.cur)}.`}</div>
      {canEdit && x.kind === 'pct' && (
        <div className="gspx-inline">
          <Field id="ov" label={`Override the RP’s amount (${x.cur})`} hint="No reason needed; the change is logged with your name." error={v.err('ov')}>
            <Input id="ov" type="number" value={ov} onBlur={v.blur('ov')} onChange={setOv} />
          </Field>
          <Button kind="primary" disabled={String(ov) === String(was)} onClick={() => save(false)}>Save override</Button>
          {x.ov && <LinkButton onClick={() => save(true)}>Remove override</LinkButton>}
        </div>)}
    </Sheet>
  );
}

/* ---------- Exceptions ---------- */
const FIX = {
  'No university terms': ['terms', 'Add the university’s terms.'],
  'Rate missing': ['terms', 'Add the rate for this level on the university’s terms.'],
  'Contract ended': ['terms', 'Enter the renewed contract and its new end date.'],
  'RP has no terms': ['terms', 'Put the RP on a scheme or give it its own %.'],
  'No RP': ['terms', 'Add the RP to RP terms.'],
  'Student type missing': [null, 'Sent to the application’s admission officer to fill in.'],
  'Send to Legal': [null, 'Forward the clawback to Legal.'],
};
function Exceptions({ c, res, go, user, canEdit }) {
  const sent = c.legal || [];
  const s = getState();
  const rule = t => opsOf(c.cfg).exceptions.find(x => x.type === t) || {};
  const toName = to => to === 'officer' ? 'The application’s admission officer' : to === 'legal' ? 'Legal' : (s.queues.find(q => q.id === to) || {}).name || to;
  return (
    <Card flush>
      <Table head={['Exception', 'Student', 'What happened', 'Blocks payment?', 'Goes to', 'What to do']} empty={!res.exc.length && <Empty title="No exceptions">Everything is priced and payable.</Empty>}>
        {res.exc.map((e, i) => { const a = c.apps[e.app] || {}; const fx = FIX[e.type] || [null, '']; return (
          <tr key={i} className="irow">
            <td className="cfg__strong">{e.type}</td>
            <td>{a.student || '—'}<span className="irow__sub">{e.app}</span></td>
            <td><span className="gspx-wrap">{e.msg}</span></td>
            <td><Pill tone={rule(e.type).blocks === false ? 'dpill--checking' : 'dpill--bad'}>{rule(e.type).blocks === false ? 'No, check it' : 'Yes'}</Pill></td>
            <td>{toName(rule(e.type).to)}<span className="irow__sub">{rule(e.type).sla ? `${rule(e.type).sla} working day${rule(e.type).sla === 1 ? '' : 's'}` : ''}</span></td>
            <td><span className="gspx-wrap">{fx[1]}</span>
              {fx[0] && <LinkButton onClick={() => go(fx[0])}>Go to Terms</LinkButton>}
              {(() => {
                // W19 (Jovial, 1 Nov): an exception for another team becomes a task in its queue (or the officer's)
                const to = rule(e.type).to;
                if (!canEdit || !to || to === 'q-finance' || to === 'legal') return null;
                const tid = `T-EXC-${e.app}-${e.type.replace(/\W+/g, '-')}`;
                const has = s.tasks.find(t => t.id === tid);
                if (has) return <span className="irow__sub">Task raised for {toName(to)}{has.status === 'done' ? ': done' : ''}</span>;
                const rec = (s.records.find(r => r.id === e.app) || {});
                return <LinkButton onClick={() => update(d => { d.tasks.unshift({ id: tid, record: e.app, kind: 'k-exception', queue: to === 'officer' ? null : to, assignee: to === 'officer' ? rec.officer || null : null, rule: null, title: `${e.type}: ${a.student || e.app}`, note: e.msg, created: Date.now(), status: 'open', slaDays: rule(e.type).sla || 2 }); }, `${user.name} sent “${e.type}” on ${e.app} to ${toName(to)}`) || toast(`Task raised for ${toName(to)}. It’s in their My work.`)}>Send to {toName(to)}</LinkButton>;
              })()}
              {e.type === 'Send to Legal' && canEdit && (sent.includes(e.app) ? <span className="irow__sub">Sent to Legal</span> :
                <LinkButton onClick={() => update(d => { d.comm.legal = [...(d.comm.legal || []), e.app]; }, `${user.name} forwarded the clawback for ${a.student} to Legal`) || toast('Forwarded to Legal.')}>Forward to Legal</LinkButton>)}
            </td>
          </tr>); })}
      </Table>
    </Card>
  );
}

/* ---------- Reports ---------- */
function Reports({ c, res, rpLines, ipLines }) {
  const month = c.today.slice(0, 7);
  const paid = ipLines.filter(x => x.l.paid);
  const byMonth = {}; paid.forEach(x => { const k = x.l.paid.date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + (x.l.aud || 0); });
  const months = Object.keys(byMonth).sort().reverse().slice(0, 12);
  const open = ipLines.filter(x => /Invoiced|overdue|Ready to invoice/.test(x.l.st[0]));
  const byUni = {}; open.forEach(x => { const u = byUni[x.u.name] = byUni[x.u.name] || { ready: 0, invoiced: 0, overdue: 0 }; const k = x.l.st[0] === 'Ready to invoice' ? 'ready' : x.l.st[0] === 'Payment overdue' ? 'overdue' : 'invoiced'; u[k] += x.l.dueAud || 0; });
  const byRp = {}; rpLines.forEach(x => { const p = x.r.payee || x.r.rp; const b = byRp[p.name] = byRp[p.name] || { ready: 0, wait: 0, recover: 0, paid: 0 };
    if (x.due < 0) b.recover += -(x.audDue || 0); else if (x.payable) b.ready += x.audDue || 0; else if (x.st[0] === 'Waiting for university payment') b.wait += x.audEnt || 0; b.paid += x.paid && x.audEnt && x.ent ? x.audEnt * x.paid / x.ent : 0; });
  const r2a = v => aud(Math.round(v * 100) / 100);
  const csvIp = () => downloadCsv(`university-ledger-${c.today}.csv`, ['Application', 'Student', 'University', 'Line', 'Trigger date', 'Currency', 'Amount', 'GST', 'Status', 'Invoiced', 'Paid on', 'AUD'],
    res.ip.map(x => [x.app, x.a.student, x.u.name, x.l.key, x.l.date, x.u.cur, x.l.ent, x.l.gst, x.l.st[0], x.l.inv || '', x.l.paid ? x.l.paid.date : '', x.l.aud]));
  const csvRp = () => downloadCsv(`rp-ledger-${c.today}.csv`, ['Application', 'Student', 'RP', 'Payee', 'Line', 'Rate %', 'Currency', 'Amount', 'Paid', 'Due', 'Status', 'AUD due'],
    res.rp.map(x => [x.app, x.a.student, x.r.rp.name, (x.r.payee || x.r.rp).name, x.label, x.lp ?? '', x.cur, x.ent, x.paid, x.due, x.st[0], x.audDue]));
  const csvRuns = () => downloadCsv(`payout-runs-${c.today}.csv`, ['Pay day', 'RPs', 'Total AUD', 'Prepared by', 'Approved by'], c.runs.map(r => [r.date, r.payees, r.totalAud, nameOf(getState(), r.preparedBy), nameOf(getState(), r.checkedBy)]));
  return (
    <>
      <div className="atiles itiles">
        <div className="atile itile itile--gsp"><span className="atile__n num">{r2a(byMonth[month] || 0)}</span><span className="atile__label">Received from universities this month</span></div>
        <div className="atile itile itile--you"><span className="atile__n num">{r2a(sum(open, x => x.l.dueAud))}</span><span className="atile__label">Outstanding from universities</span><span className="itile__sub">Ready to invoice, invoiced and overdue</span></div>
        <div className="atile itile itile--gsp"><span className="atile__n num">{r2a(Object.values(byRp).reduce((t, b) => t + b.ready + b.wait, 0))}</span><span className="atile__label">Owed to RPs</span><span className="itile__sub">Ready to pay and waiting for universities</span></div>
        <div className="atile itile itile--gsp"><span className="atile__n num">{r2a(sum(c.runs, r => r.totalAud))}</span><span className="atile__label">Paid in payout runs</span><span className="itile__sub">{c.runs.length} runs</span></div>
      </div>
      <Card><div className="gspx-inline"><span className="gspx-h3 gspx-grow">Export for Xero and month-end</span><Button onClick={csvIp}>University ledger (CSV)</Button><Button onClick={csvRp}>RP ledger (CSV)</Button><Button onClick={csvRuns}>Payout runs (CSV)</Button></div></Card>
      <div className="gspx-grid2">
        <Card flush><div className="gspx-pad"><h2 className="gspx-h3">Received from universities, by month</h2></div>
          <Table head={['Month', 'Received (AUD)']}>{months.map(k => <tr key={k} className="irow"><td className="num">{nice(k + '-01').slice(2)}</td><td className="num">{r2a(byMonth[k])}</td></tr>)}</Table></Card>
        <Card flush><div className="gspx-pad"><h2 className="gspx-h3">Outstanding by university</h2></div>
          <Table head={['University', 'Ready', 'Invoiced', 'Overdue']}>{Object.entries(byUni).sort((a, b) => (b[1].overdue + b[1].invoiced) - (a[1].overdue + a[1].invoiced)).map(([k, v]) => (
            <tr key={k} className="irow"><td>{k}</td><td className="num">{r2a(v.ready)}</td><td className="num">{r2a(v.invoiced)}</td><td className="num">{v.overdue ? <b>{r2a(v.overdue)}</b> : '—'}</td></tr>))}</Table></Card>
      </div>
      <Card flush><div className="gspx-pad"><h2 className="gspx-h3">Balance by RP (AUD)</h2></div>
        <Table head={['RP', 'Paid', 'Ready to pay', 'Waiting for universities', 'To recover']}>{Object.entries(byRp).sort((a, b) => b[1].ready - a[1].ready).map(([k, v]) => (
          <tr key={k} className="irow"><td>{k}</td><td className="num">{r2a(v.paid)}</td><td className="num">{r2a(v.ready)}</td><td className="num">{r2a(v.wait)}</td><td className="num">{v.recover ? r2a(v.recover) : '—'}</td></tr>))}</Table></Card>
    </>
  );
}

/* ---------- Finance processes ---------- */
function Processes() {
  return (
    <>
      <Notice>What Finance does to keep commissions automatic: enter terms once from contracts, agreements and notices, then run the weekly and daily jobs. Everything else is calculated.</Notice>
      {COMM.procs.map(g => (
        <Card key={g.g}>
          <h2 className="gspx-h3">{g.g}</h2>
          {g.items.map(it => (
            <details key={it.t} className="gspx-proc">
              <summary><b>{it.t}</b><span className="muted"> · {it.who} · {it.when}</span></summary>
              <ol>{it.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
              {it.auto && <p className="gspx-sentence">Automatic: {it.auto}</p>}
            </details>))}
        </Card>))}
    </>
  );
}
