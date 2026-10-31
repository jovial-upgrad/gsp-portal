// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Thursday payout run. One Finance person prepares it, which raises an invoice
 * (RCTI) on each RP's behalf; the RP approves it in Earnings; a second Finance
 * person approves payment of approved invoices. Batch 1: Australian bank
 * accounts. Batch 2: local accounts. A run is held for any currency without
 * this week's rate.
 */
import React, { useState } from 'react';
import { update, nameOf, getState } from './store';
import { Card, Table, Pill, Button, LinkButton, Sheet, Empty, Notice, toast } from './kit';
import { nice, money, r2 } from './engine';
import { aud, sum, opsOf, DAYS } from './shared';

const INV = { sent: ['Waiting for the RP', 'dpill--checking'], approved: ['Approved by the RP', 'dpill--verified'], queried: ['Queried by the RP', 'dpill--bad'], paying: ['Approved: paid on pay day', 'dpill--verified'] };
const iso = t => new Date(t).toISOString().slice(0, 10);
const addD = (d, n) => iso(Date.parse(d + 'T00:00:00Z') + n * 864e5);

export default function Payout({ c, res, run, user, canPrepare, canApprove }) {
  const s = getState();
  const [view, setView] = useState(null);
  const payees = Object.values(run.payees).sort((a, b) => a.name < b.name ? -1 : 1);
  const ops = opsOf(c.cfg);
  const selfCheck = c.cfg.settings.selfCheck || !ops.makerChecker.run;
  const isMaker = run.preparedBy === user.id;
  const total = sum(run.lines, L => L.aud);
  const needsAdmin = ops.adminAbove && total > ops.adminAbove;

  const prepare = () => update(d => {
    const invoices = {}; let n = 1;
    payees.forEach(p => { if (!Object.values(p.total).some(v => v <= 0)) invoices[p.id] = { no: `${ops.rctiPrefix}-${run.date.replace(/-/g, '')}-${String(n++).padStart(3, '0')}`, status: ops.rpApproves ? 'sent' : 'approved' }; });
    d.comm.run = { date: run.date, status: 'prepared', preparedBy: user.id, preparedAt: Date.now(), invoices };
    d.records.push({ id: 'cm-run-' + run.date, type: 'Commission', label: 'Payout run · ' + nice(run.date) });
    d.tasks.unshift({ id: 'T-RUN-' + run.date, record: 'cm-run-' + run.date, kind: 'k-payout', queue: 'q-finance', rule: null, title: `Approve the payout run for ${nice(run.date)}`, maker: user.id, created: Date.now(), status: 'open' });
  }, `${user.name} prepared the payout run for ${nice(run.date)}`) || toast('Run prepared. Each RP has an invoice to approve in Earnings.');

  const rpApprove = p => update(d => { d.comm.run.invoices[p.id].status = 'approved'; }, `${p.name} approved invoice ${run.invoices[p.id].no} (marked by ${user.name})`);

  const approve = () => {
    if (isMaker && !selfCheck) { toast('You prepared this run, so someone else must approve it.'); return; }
    if (needsAdmin && user.role !== 'admin') { toast(`Runs over ${aud(ops.adminAbove)} also need an Admin to approve (Finance setup).`); return; }
    const ok = payees.filter(p => run.invoices[p.id]?.status === 'approved');
    if (!ok.length) { toast('No RP has approved its invoice yet.'); return; }
    const lines = run.lines.filter(L => ok.some(p => p.id === L.payee) && L.pay != null);
    // W13 (1 Nov): approved now, paid on pay day. Until then the lines are Approved, not Paid, here and in the RP's
    // Earnings; settleRuns (store.ts) pays them on the day.
    update(d => {
      ok.forEach(p => { d.comm.run.invoices[p.id].status = 'paying'; });
      d.comm.runs.unshift({ id: 'RUN-' + run.date + '-' + d.comm.runs.length, date: run.date, status: 'approved', preparedBy: run.preparedBy, checkedBy: user.id, approvedAt: Date.now(), payees: ok.length, totalAud: sum(lines, L => L.aud), lines: lines.map(L => ({ app: L.app, key: L.key, src: L.src, payee: L.payee })) });
      if (Object.values(d.comm.run.invoices).every(i => i.status === 'paying')) d.comm.run.status = 'approved';
      const t = d.tasks.find(x => x.id === 'T-RUN-' + run.date); if (t) { t.status = 'done'; t.doneBy = user.id; t.doneAt = Date.now(); }
    }, `${user.name} approved the payout run for ${nice(run.date)}: ${ok.length} RPs, ${aud(sum(lines, L => L.aud))}, paid on ${nice(run.date)}`);
    toast(`Approved. ${ok.length} RP${ok.length === 1 ? ' is' : 's are'} paid on ${DAYS[new Date(run.date + 'T00:00:00Z').getUTCDay()]} ${nice(run.date)}: bills go to Xero, batch 1 (Australian accounts) and batch 2 (local).`);
  };

  const batch = b => payees.filter(p => (p.bank || 'AU') === b);
  const batches = ops.batches;
  const totals = p => Object.entries(p.total).map(([cur, v]) => money(v, cur)).join(' + ');
  // W13: prepared on the Monday before pay day, approved and paid on pay day (Thursday by default)
  const prepDay = addD(run.date, -((new Date(run.date + 'T00:00:00Z').getUTCDay() + 6) % 7));
  const day = d => `${DAYS[new Date(d + 'T00:00:00Z').getUTCDay()].slice(0, 3)} ${nice(d)}`;
  const paying = Object.values(run.invoices).filter(i => i.status === 'paying').length;
  const steps = [
    [`Prepare · ${day(prepDay)}`, run.status === 'draft' ? (c.today < prepDay ? `Opens ${day(prepDay)}` : 'Not yet') : `Done by ${nameOf(s, run.preparedBy)}`],
    ['RPs approve their invoices', !ops.rpApproves ? 'Not needed (Finance setup)' : run.status === 'draft' ? `Within ${ops.rpApproveDays} working days of preparing` : `${Object.values(run.invoices).filter(i => i.status === 'approved' || i.status === 'paying').length} of ${Object.keys(run.invoices).length} approved`],
    [`${ops.makerChecker.run ? 'Second person approves payment' : 'Approve payment'} · paid ${day(run.date)}`, needsAdmin ? `Over ${aud(ops.adminAbove)}: an Admin approves` : run.status === 'draft' ? 'After preparing' : paying ? `${paying} approved: shown as Approved until ${day(run.date)}, then Paid` : 'Waiting'],
  ];

  return (
    <>
      <Card>
        <div className="gspx-row">
          <div className="gspx-grow">
            <h2 className="gspx-h3">Payout run · {DAYS[new Date(run.date + 'T00:00:00Z').getUTCDay()]} {nice(run.date)}</h2>
            <p><span className="num">{payees.length}</span> RPs · <span className="num">{run.lines.length}</span> lines · <b className="num">{aud(sum(run.lines, L => L.aud))}</b></p>
          </div>
          <div className="gspx-acts">
            {canPrepare && run.status === 'draft' && <Button kind="primary" disabled={!payees.length} onClick={prepare}>Prepare run</Button>}
            {canApprove && run.status === 'prepared' && Object.values(run.invoices).some(i => i.status === 'approved') && <Button kind="primary" onClick={approve}>Approve payment</Button>}
            {run.status === 'approved' && <Pill tone="dpill--verified">Approved: paid {day(run.date)}</Pill>}
          </div>
        </div>
        <ol className="gspx-steps">{steps.map(([t, d], i) => <li key={t}><b>{i + 1}. {t}</b><span className="muted">{d}</span></li>)}</ol>
        {run.hold.length > 0 && <Notice tone="warn">Lines in {run.hold.join(', ')} are held: this week has no rate for {run.hold.length > 1 ? 'these currencies' : 'this currency'}. Enter it in GSP · Admin › Course configuration › Currency exchange.</Notice>}
        {run.bankHold.length > 0 && <Notice tone="warn">Held until new bank details are verified (Setup › Commission terms, RP terms): {run.bankHold.join(', ')}.</Notice>}
        {isMaker && run.status === 'prepared' && !selfCheck && <Notice>You prepared this run. {nameOf(s, s.users.find(u => u.role === 'finance' && u.id !== user.id)?.id)} or another Finance person approves it.</Notice>}
      </Card>
      {batches.map(bt => { const b = bt.bank; return batch(b).length > 0 && (
        <Card flush key={bt.id}>
          <div className="gspx-pad"><h2 className="gspx-h3">{bt.name}</h2></div>
          <Table head={['RP', 'Lines', 'Net', 'GST', 'Withholding', 'To pay', 'Invoice', '']}>
            {batch(b).map(p => { const inv = run.invoices[p.id]; const held = p.lines.some(L => L.pay == null); const neg = Object.values(p.total).some(v => v <= 0); return (
              <tr key={p.id} className="irow">
                <td>{p.name}<span className="irow__sub">{p.id}</span></td>
                <td className="num">{p.lines.length}</td>
                <td className="num">{Object.entries(p.byCur).map(([cur, v]) => money(v.net, cur)).join(' + ')}</td>
                <td className="num">{Object.entries(p.byCur).map(([cur, v]) => v.gst ? money(v.gst, cur) : '—').join(' + ')}</td>
                <td className="num">{Object.entries(p.byCur).map(([cur, v]) => v.wht ? money(-v.wht, cur) : '—').join(' + ')}</td>
                <td className="num"><b>{held ? 'Held' : totals(p)}</b>{neg && <span className="irow__sub">Recovery is larger: carried to next run</span>}</td>
                <td>{inv ? <><Pill tone={INV[inv.status][1]}>{INV[inv.status][0]}</Pill><span className="irow__sub">{inv.no}</span></> : <span className="muted">{run.status === 'draft' ? 'Raised when prepared' : neg ? 'None: nothing to pay' : '—'}</span>}</td>
                <td><div className="gspx-acts">
                  <LinkButton onClick={() => setView(p)}>Lines</LinkButton>
                  {inv && inv.status !== 'approved' && inv.status !== 'paying' && canApprove && <LinkButton onClick={() => rpApprove(p)}>Mark approved by RP</LinkButton>}
                </div></td>
              </tr>); })}
          </Table>
        </Card>); })}
      {!payees.length && <Card><Empty title="Nothing to pay this Thursday">Lines become payable once the university has paid GSP.</Empty></Card>}
      <Card flush>
        <div className="gspx-pad"><h2 className="gspx-h3">Earlier runs</h2></div>
        <Table head={['Thursday', 'RPs', 'Total', 'Prepared by', 'Approved by', 'Status']}>
          {c.runs.map(r => (
            <tr key={r.id} className="irow"><td className="num">{nice(r.date)}</td><td className="num">{r.payees}</td><td className="num">{aud(r.totalAud)}</td>
              <td>{nameOf(s, r.preparedBy)}</td><td>{nameOf(s, r.checkedBy)}</td><td>{r.status === 'approved' ? <Pill tone="dpill--checking">Approved: paid {nice(r.date)}</Pill> : <Pill tone="dpill--verified">Paid</Pill>}</td></tr>))}
        </Table>
      </Card>
      {view && (
        <Sheet title={`${view.name} · lines in this run`} onClose={() => setView(null)} wide footer={<Button onClick={() => setView(null)}>Close</Button>}>
          <Table head={['Student', 'Line', 'Amount', 'In AUD', `In ${Object.keys(view.byCur).join(', ')}`]}>
            {view.lines.map(L => (
              <tr key={L.app + L.key} className="irow"><td>{L.student}<span className="irow__sub">{L.app}</span></td><td>{L.label}</td>
                <td className="num">{money(L.src, L.srcCur)}</td><td className="num">{aud(L.aud)}</td><td className="num">{L.pay == null ? 'Held' : money(L.pay, L.payCur)}</td></tr>))}
          </Table>
        </Sheet>)}
    </>
  );
}
