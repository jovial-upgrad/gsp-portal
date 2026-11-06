// @ts-nocheck -- typed with the finance API.
/*
 * RP invoices and payout (Jovial, 5 Nov: Commissions flow Q11–Q19, Q23). Monthly: each RP invoices the lines that
 * became eligible (GSP was paid for them) by uploading its signed copy of the system invoice. One Finance person checks
 * it against Finance setup's checklist, approves it or sends it back with a reason, and pays approved invoices by the
 * cycle's pay-by day, marking each paid with the bank reference. No second person. RPs whose new bank details aren't
 * verified, or whose currency has no rate, are held.
 */
import React, { useState } from 'react';
import { update, getState } from './store';
import { Card, Table, Pill, Button, LinkButton, Sheet, Empty, Notice, Field, Input, DateField, Select, toast } from './kit';
import { nice, money, r2 } from './engine';
import { opsOf, cycleOf } from './shared';
import { INV_STATUS, onInvoice } from './rpInvoice';

const days = (a, b) => Math.floor((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
const tot = (inv) => Object.entries(inv.total).map(([k, v]) => money(v, k)).join(' + ');

export default function Payout({ c, res, run, user, canPrepare, canApprove }) {
  const s = getState();
  const ops = opsOf(c.cfg);
  const cyc = cycleOf(c.cfg, c.today);
  const [check, setCheck] = useState(null);
  const [pay, setPay] = useState(null);
  const [answer, setAnswer] = useState(null);
  const invs = Object.values(c.rpInv || {}).sort((a, b) => (a.status === b.status ? a.rpName.localeCompare(b.rpName) : ORDER.indexOf(a.status) - ORDER.indexOf(b.status)));
  const open = invs.filter((i) => i.status !== 'paid');
  const paid = invs.filter((i) => i.status === 'paid').sort((a, b) => b.paidAt - a.paidAt);
  const taken = onInvoice(c);
  // RPs with eligible lines and no invoice yet: they're reminded at the days in Finance setup (Q15)
  const waiting = Object.values(run.payees).filter((p) => !open.some((i) => i.rp === p.id) && p.lines.some((L) => !taken.has(L.app + '|' + L.key)));
  const since = days(cycleOf(c.cfg, c.today).cutoff, c.today);
  const reminded = (ops.invoiceReminders || []).filter((d) => since >= d);
  const queries = (c.queries || []).filter((q) => q.status === 'open');
  const can = canApprove || canPrepare;

  return (
    <>
      <Card>
        <h2 className="gspx-h3">RP invoices · {cyc.label}</h2>
        <p>Lines that are ready by the cut-off on <b>{nice(cyc.cutoff)}</b> go on that month’s invoice. GSP pays approved invoices by <b>{nice(cyc.payBy)}</b>.</p>
        <ol className="gspx-steps">
          <li><b>1. The RP uploads its invoice</b><span className="muted">{open.filter((i) => i.status === 'draft').length} downloaded, not uploaded · {waiting.length} RPs not started</span></li>
          <li><b>2. Finance checks it</b><span className="muted">{open.filter((i) => i.status === 'review').length} to check · {open.filter((i) => i.status === 'sentback').length} sent back</span></li>
          <li><b>3. Finance pays it</b><span className="muted">{open.filter((i) => i.status === 'approved').length} approved, to pay by {nice(cyc.payBy)}</span></li>
        </ol>
        {run.hold.length > 0 && <Notice tone="warn">Lines in {run.hold.join(', ')} are held: there’s no exchange rate for {run.hold.length > 1 ? 'these currencies' : 'this currency'} this week. Enter it in Finance › Exchange rates.</Notice>}
        {run.bankHold.length > 0 && <Notice tone="warn">Held until RP Ops verifies new bank details: {run.bankHold.join(', ')}.</Notice>}
      </Card>

      <Card flush>
        <div className="gspx-pad"><h2 className="gspx-h3">Invoices</h2></div>
        <Table head={['RP', 'Month', 'Lines', 'To pay', 'To', 'Status', '']} empty={!open.length && <Empty title="No invoices yet">An RP’s invoice shows here once it downloads or uploads one.</Empty>}>
          {open.map((i) => (
            <tr key={i.id} className="irow">
              <td>{i.rpName}<span className="irow__sub">{i.rp}</span></td>
              <td>{i.cycleLabel}<span className="irow__sub">{i.ref}{i.rpNo ? ` · RP’s number ${i.rpNo}` : ''}</span></td>
              <td className="num">{i.lines.length}</td>
              <td className="num"><b>{tot(i)}</b></td>
              <td>{i.entity?.name}</td>
              <td><Pill tone={INV_STATUS[i.status][1]}>{INV_STATUS[i.status][0]}</Pill>{i.status === 'sentback' && <span className="irow__sub">{i.reason}</span>}</td>
              <td><div className="gspx-acts">
                {can && i.status === 'review' && <Button size="sm" kind="primary" onClick={() => setCheck(i)}>Check</Button>}
                {can && i.status === 'approved' && <Button size="sm" kind="primary" onClick={() => setPay(i)}>Mark paid</Button>}
                {(i.status === 'draft' || i.status === 'sentback') && <span className="muted">Waiting for the RP</span>}
              </div></td>
            </tr>))}
        </Table>
      </Card>

      {waiting.length > 0 && (
        <Card flush>
          <div className="gspx-pad"><h2 className="gspx-h3">Ready to invoice, no invoice yet</h2><p className="muted">These RPs have lines ready. They’re reminded {(ops.invoiceReminders || []).join(', ')} days after the cut-off{reminded.length ? `; ${reminded.length} reminder${reminded.length === 1 ? '' : 's'} sent this month` : ''}. Nothing expires: the lines stay ready for the next month.</p></div>
          <Table head={['RP', 'Lines', 'Ready']}>
            {waiting.map((p) => (
              <tr key={p.id} className="irow"><td>{p.name}<span className="irow__sub">{p.id}</span></td><td className="num">{p.lines.filter((L) => !taken.has(L.app + '|' + L.key)).length}</td><td className="num">{Object.entries(p.total).map(([k, v]) => money(v, k)).join(' + ')}</td></tr>))}
          </Table>
        </Card>)}

      {queries.length > 0 && (
        <Card flush>
          <div className="gspx-pad"><h2 className="gspx-h3">Queries from RPs</h2></div>
          <Table head={['RP', 'Line', 'Question', '']}>
            {queries.map((q) => (
              <tr key={q.id} className="irow"><td>{q.rpName}</td><td>{q.student}<span className="irow__sub">{q.app} · {q.line}</span></td><td>{q.text}<span className="irow__sub">{q.by}, {nice(new Date(q.at).toISOString().slice(0, 10))}</span></td>
                <td>{can && <LinkButton onClick={() => setAnswer(q)}>Answer</LinkButton>}</td></tr>))}
          </Table>
        </Card>)}

      <Card flush>
        <div className="gspx-pad"><h2 className="gspx-h3">Paid</h2></div>
        <Table head={['RP', 'Month', 'Paid', 'Bank reference', 'Paid on', 'By']} empty={!paid.length && <Empty title="Nothing paid yet" />}>
          {paid.map((i) => (
            <tr key={i.id} className="irow"><td>{i.rpName}</td><td>{i.cycleLabel}<span className="irow__sub">{i.ref} · {i.rpNo}</span></td><td className="num">{tot(i)}</td><td>{i.paidRef}</td><td className="num">{nice(i.paidOn)}</td><td>{i.paidBy}</td></tr>))}
        </Table>
      </Card>
      {check && <CheckSheet inv={check} ops={ops} user={user} onClose={() => setCheck(null)} />}
      {pay && <PaySheet inv={pay} c={c} user={user} onClose={() => setPay(null)} />}
      {answer && <AnswerSheet q={answer} user={user} onClose={() => setAnswer(null)} />}
    </>
  );
}
const ORDER = ['review', 'approved', 'sentback', 'draft', 'paid'];

/** Check an uploaded invoice (Q16): the checklist from Finance setup; approve, or send back with a reason. */
function CheckSheet({ inv, ops, user, onClose }) {
  const [ticks, setTicks] = useState({});
  const [back, setBack] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const all = ops.invoiceChecks.every((k) => ticks[k]);
  const approve = () => {
    update((d) => { const i = d.comm.rpInv[inv.id]; i.status = 'approved'; i.checkedBy = user.name; i.checkedAt = Date.now(); i.history.push({ at: Date.now(), by: user.name, what: 'Approved' }); }, `${user.name} approved ${inv.rpName}’s invoice ${inv.rpNo} for ${inv.cycleLabel}`);
    toast('Approved', { text: `It’s paid by ${nice(inv.payBy)}. ${inv.rpName} is told.` }); onClose();
  };
  const sendBack = () => {
    if (!reason) { toast('Choose why it’s sent back.'); return; }
    update((d) => { const i = d.comm.rpInv[inv.id]; Object.assign(i, { status: 'sentback', reason, note: note.trim() || null }); i.history.push({ at: Date.now(), by: user.name, what: `Sent back: ${reason}` }); }, `${user.name} sent back ${inv.rpName}’s invoice ${inv.rpNo}: ${reason}`);
    toast('Sent back', { text: `${inv.rpName} is told why and uploads it again.` }); onClose();
  };
  return (
    <Sheet title={`Check ${inv.rpName}’s invoice`} sub={`${inv.cycleLabel} · RP’s number ${inv.rpNo}, dated ${nice(inv.rpDate)} · ${inv.file}`} onClose={onClose} wide
      footer={back ? <><Button onClick={() => setBack(false)}>Back</Button><Button kind="primary" onClick={sendBack}>Send back</Button></> : <><Button onClick={() => setBack(true)}>Send back</Button><Button kind="primary" disabled={!all} onClick={approve}>Approve</Button></>}>
      {!back ? <>
        <p className="muted">Tick each check against the uploaded file. Approve turns on when every check is ticked.</p>
        {ops.invoiceChecks.map((k) => <label key={k} className="gspx-check"><input type="checkbox" checked={!!ticks[k]} onChange={(e) => setTicks({ ...ticks, [k]: e.target.checked })} /> {k}</label>)}
        <Table head={['Student', 'Line', 'Amount']}>
          {inv.lines.map((L) => <tr key={L.app + L.key} className="irow"><td>{L.student}<span className="irow__sub">{L.app}</span></td><td>{L.label}</td><td className="num">{money(L.pay, L.payCur)}</td></tr>)}
        </Table>
        <p>{Object.entries(inv.byCur).map(([k, v]) => `${money(v.net, k)} commission${v.gst ? ` + ${money(v.gst, k)} tax` : ''}${v.wht ? ` − ${money(v.wht, k)} withheld` : ''} = ${money(r2(v.net + v.gst - v.wht), k)}`).join('; ')}</p>
      </> : <>
        <Select id="sb-r" label="Why it’s sent back" required value={reason} onChange={setReason} placeholder="Choose a reason" options={ops.sendBackReasons.map((r) => [r, r])} />
        <Field id="sb-n" label="Note to the RP" hint="Optional"><Input id="sb-n" value={note} onChange={setNote} /></Field>
      </>}
    </Sheet>
  );
}

/** Mark an approved invoice paid (Q17): the bank reference and date; the RP gets its remittance. */
function PaySheet({ inv, c, user, onClose }) {
  const [ref, setRef] = useState('');
  const [on, setOn] = useState(c.today);
  const go = () => {
    if (!ref.trim()) { toast('Enter the bank reference.'); return; }
    update((d) => {
      const i = d.comm.rpInv[inv.id]; Object.assign(i, { status: 'paid', paidRef: ref.trim(), paidOn: on, paidAt: Date.now(), paidBy: user.name }); i.history.push({ at: Date.now(), by: user.name, what: `Paid, reference ${ref.trim()}` });
      for (const L of inv.lines) { const a = d.comm.apps[L.app]; if (a) a.paidRP = { ...(a.paidRP || {}), [L.key]: r2(((a.paidRP || {})[L.key] || 0) + L.src) }; }
    }, `${user.name} paid ${inv.rpName}’s invoice ${inv.rpNo} for ${inv.cycleLabel}: ${tot(inv)}, reference ${ref.trim()}`);
    toast('Marked paid', { text: `${inv.rpName} gets the remittance with reference ${ref.trim()}.` }); onClose();
  };
  return (
    <Sheet title={`Mark ${inv.rpName} paid`} sub={`${inv.cycleLabel} · ${tot(inv)}`} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button kind="primary" onClick={go}>Mark paid</Button></>}>
      <Field id="p-ref" label="Bank reference" required><Input id="p-ref" value={ref} onChange={setRef} /></Field>
      <Field id="p-on" label="Paid on" required><DateField id="p-on" value={on} onChange={setOn} /></Field>
    </Sheet>
  );
}

function AnswerSheet({ q, user, onClose }) {
  const [t, setT] = useState('');
  const go = () => {
    if (!t.trim()) { toast('Write the answer.'); return; }
    update((d) => { const x = d.comm.queries.find((y) => y.id === q.id); x.status = 'answered'; x.answer = t.trim(); x.answeredBy = user.name; x.answeredAt = Date.now(); }, `${user.name} answered ${q.rpName}’s query on ${q.student}`);
    toast('Answered', { text: `${q.rpName} sees it on the line.` }); onClose();
  };
  return (
    <Sheet title={`Answer ${q.rpName}`} sub={`${q.student} · ${q.line}`} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button kind="primary" onClick={go}>Send</Button></>}>
      <p>{q.text}</p>
      <Field id="a-t" label="Answer" required><Input id="a-t" value={t} onChange={setT} /></Field>
    </Sheet>
  );
}
