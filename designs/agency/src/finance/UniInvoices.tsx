// @ts-nocheck -- typed with the finance API.
/*
 * University invoices (Jovial, 5 Nov: Commissions flow Q24–Q27). Each month GSP batches a university's due lines
 * into one invoice (or one per student, if the university's terms say so), from the upGrad entity for its destination,
 * numbered in that entity's series, due after the contract's days to pay. Self-billing universities aren't invoiced:
 * their statement or remittance is matched to the due lines when it arrives. A payment that doesn't match the invoice
 * becomes an exception with a reason, resolved or written off by one Finance person.
 */
import React, { useState } from 'react';
import { update } from './store';
import { Card, Table, Pill, Button, LinkButton, Sheet, Empty, Notice, Field, Input, NumberInput, DateField, Select, toast } from './kit';
import { nice, money, r2, addDays } from './engine';
import { opsOf, cycleOf, entityFor } from './shared';

const due = (x) => /^(Ready|Top-up) to invoice/.test(x.l.st[0]);
const daysBetween = (a, b) => Math.floor((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

/** The batches to raise now: per university per month, or per student where the terms say so; none for self-billing. */
export function batchesOf(lines, cfg, uniInv = {}) {
  const m = new Map();
  // a shortfall on a paid invoice is a payment difference, worked in Payment differences, never invoiced again
  const short = new Set(Object.values(uniInv).filter((i) => i.received != null && i.received !== i.total).flatMap((i) => i.lines.map((L) => L.app + '|' + L.key)));
  lines.filter(due).forEach((x) => {
    if (x.u.selfBilling) return;
    if (x.l.topup && short.has(x.app + '|' + x.l.parent)) return;
    const k = x.u.invoicePer === 'student' ? `${x.u.id}|${x.app}` : x.u.id;
    const b = m.get(k) || { key: k, u: x.u, student: x.u.invoicePer === 'student' ? x.a.student : null, lines: [] };
    b.lines.push(x); m.set(k, b);
  });
  return [...m.values()].map((b) => ({ ...b, total: r2(b.lines.reduce((t, x) => t + (x.l.ent || 0) + (x.l.gst || 0), 0)), entity: entityFor(cfg, { destination: b.u.country }) }));
}

/** Raise one batch's invoice (to the university, from its entity, numbered in the entity's series). */
export const raiseBatch = (b, cyc, user) => update((d) => {
    const n = Object.values(d.comm.uniInv || {}).filter((i) => i.entity === b.entity.id && i.cycle === cyc.key).length + 1;
    const no = `${b.entity.prefix}-${cyc.key.replace('-', '')}-${String(n).padStart(3, '0')}`;
    d.comm.uniInv = { ...(d.comm.uniInv || {}), [no]: { no, cycle: cyc.key, entity: b.entity.id, entityName: b.entity.name, uni: b.u.id, uniName: b.u.name, student: b.student, cur: b.u.cur, total: b.total, raised: d.comm.today, dueOn: addDays(d.comm.today, +b.u.payDays || 30), lines: b.lines.map((x) => ({ app: x.app, key: x.l.key, student: x.a.student, label: x.l.label, amt: x.l.ent, gst: x.l.gst || 0 })), status: 'sent', by: user.name } };
    b.lines.forEach((x) => { const a = d.comm.apps[x.app]; a.inv = { ...(a.inv || {}), [x.l.key]: d.comm.today }; a.invAmt = { ...(a.invAmt || {}), [x.l.key]: x.l.ent }; });
  }, `${user.name} raised an invoice to ${b.u.name}${b.student ? ` for ${b.student}` : ''}: ${b.lines.length} lines, ${money(b.total, b.u.cur)}`) || toast('Invoice raised', { text: `To ${b.u.name}, from ${b.entity.name}. Due in ${b.u.payDays} days.` });;

export default function UniInvoices({ c, lines, canEdit, user }) {
  const ops = opsOf(c.cfg);
  const [pay, setPay] = useState(null);
  const [fix, setFix] = useState(null);
  const batches = batchesOf(lines, c.cfg, c.uniInv);
  const self = [...new Map(lines.filter((x) => due(x) && x.u.selfBilling).map((x) => [x.u.id, x.u])).values()];
  const invs = Object.values(c.uniInv || {}).sort((a, b) => (a.status === b.status ? b.raised.localeCompare(a.raised) : a.status === 'paid' ? 1 : -1));
  const diffs = (c.diffs || []).filter((d) => d.status === 'open');
  const cyc = cycleOf(c.cfg, c.today);

  const raise = (b) => raiseBatch(b, cyc, user);

  return (
    <>
      <Card flush>
        <div className="gspx-pad"><h2 className="gspx-h3">To invoice · {cyc.label}</h2><p className="muted">Due lines batched per university for the month, or per student where the university’s terms say so.</p></div>
        <Table head={['University', 'From', 'Lines', 'Amount', '']} empty={!batches.length && <Empty title="Nothing to invoice" />}>
          {batches.map((b) => (
            <tr key={b.key} className="irow">
              <td>{b.u.name}{b.student && <span className="irow__sub">{b.student}</span>}</td>
              <td>{b.entity?.name}</td>
              <td className="num">{b.lines.length}</td>
              <td className="num">{money(b.total, b.u.cur)}<span className="irow__sub">including tax</span></td>
              <td>{canEdit && <Button size="sm" kind="primary" onClick={() => raise(b)}>Raise invoice</Button>}</td>
            </tr>))}
        </Table>
      </Card>
      {self.length > 0 && <Notice>Self-billing, so GSP doesn’t invoice them: {self.map((u) => u.name).join(', ')}. Their due lines are matched when the statement or remittance arrives (Record payment on the lines below).</Notice>}
      <Card flush>
        <div className="gspx-pad"><h2 className="gspx-h3">Invoices raised</h2><p className="muted">Reminders go at the due date and {ops.overdueReminders.filter(Boolean).map((d) => `+${d}`).join(', ')} days, then the overdue task escalates.</p></div>
        <Table head={['Invoice', 'University', 'Amount', 'Due', 'Status', '']} empty={!invs.length && <Empty title="No invoices raised yet" />}>
          {invs.map((i) => {
            const late = i.status !== 'paid' && c.today > i.dueOn ? daysBetween(i.dueOn, c.today) : 0;
            return (
              <tr key={i.no} className="irow">
                <td>{i.no}<span className="irow__sub">{i.entityName} · {nice(i.raised)}</span></td>
                <td>{i.uniName}{i.student && <span className="irow__sub">{i.student}</span>}</td>
                <td className="num">{money(i.total, i.cur)}{i.received != null && i.received !== i.total && <span className="irow__sub">Received {money(i.received, i.cur)}</span>}</td>
                <td className="num">{nice(i.dueOn)}{late ? <span className="irow__sub">{late} days late</span> : null}</td>
                <td><Pill tone={i.status === 'paid' ? 'dpill--verified' : late ? 'dpill--bad' : 'dpill--checking'}>{i.status === 'paid' ? 'Paid' : i.status === 'difference' ? 'Paid, with a difference' : late ? 'Overdue' : 'Sent'}</Pill></td>
                <td>{canEdit && i.status === 'sent' && <Button size="sm" onClick={() => setPay(i)}>Record payment</Button>}</td>
              </tr>);
          })}
        </Table>
      </Card>
      {diffs.length > 0 && (
        <Card flush>
          <div className="gspx-pad"><h2 className="gspx-h3">Payment differences</h2></div>
          <Table head={['Invoice', 'University', 'Invoiced', 'Received', 'Difference', 'Reason', '']}>
            {diffs.map((d) => (
              <tr key={d.id} className="irow"><td>{d.inv}</td><td>{d.uniName}</td><td className="num">{money(d.expected, d.cur)}</td><td className="num">{money(d.received, d.cur)}</td><td className="num"><b>{money(r2(d.received - d.expected), d.cur)}</b></td><td>{d.reason}</td>
                <td>{canEdit && <LinkButton onClick={() => setFix(d)}>Resolve</LinkButton>}</td></tr>))}
          </Table>
        </Card>)}
      {pay && <PaySheet inv={pay} c={c} ops={ops} user={user} onClose={() => setPay(null)} />}
      {fix && <FixSheet d={fix} user={user} onClose={() => setFix(null)} />}
    </>
  );
}

/** Record what the university paid against an invoice; a difference needs a reason and becomes an exception (Q27). */
export function PaySheet({ inv, c, ops, user, onClose }) {
  const [amt, setAmt] = useState(inv.total);
  const [on, setOn] = useState(c.today);
  const [ref, setRef] = useState('');
  const [reason, setReason] = useState('');
  const diff = r2((+amt || 0) - inv.total);
  // record payment asks for confirmation first (Jovial, 6 Nov)
  const [sure, setSure] = useState(false);
  const next = () => {
    if (!ref.trim()) { toast('Enter the remittance or bank reference.'); return; }
    if (diff && !reason) { toast('Choose why the amount is different.'); return; }
    setSure(true);
  };
  const go = () => {
    update((d) => {
      const i = d.comm.uniInv[inv.no]; i.received = +amt; i.paidOn = on; i.ref = ref.trim(); i.status = diff ? 'difference' : 'paid';
      const f = inv.total ? +amt / inv.total : 1;
      inv.lines.forEach((L) => { const a = d.comm.apps[L.app]; a.paidIP = { ...(a.paidIP || {}), [L.key]: { date: on, amt: r2((L.amt || 0) * f) } }; });
      if (diff) d.comm.diffs = [...(d.comm.diffs || []), { id: 'D-' + Date.now().toString(36), inv: inv.no, uni: inv.uni, uniName: inv.uniName, cur: inv.cur, expected: inv.total, received: +amt, reason, status: 'open', at: Date.now(), by: user.name }];
    }, `${user.name} recorded ${money(+amt, inv.cur)} from ${inv.uniName} against ${inv.no}${diff ? ` (${money(diff, inv.cur)} different: ${reason})` : ''}`);
    toast(diff ? 'Recorded, with a difference' : 'Payment recorded', { text: diff ? 'It’s in Payment differences until it’s resolved or written off.' : 'The RPs’ shares are now ready to invoice.' }); onClose();
  };
  return (
    <Sheet title={`Payment for ${inv.no}`} sub={`${inv.uniName} · ${money(inv.total, inv.cur)} invoiced`} onClose={onClose} footer={sure ? <><Button onClick={() => setSure(false)}>Back</Button><Button kind="primary" onClick={go}>Confirm payment</Button></> : <><Button onClick={onClose}>Cancel</Button><Button kind="primary" onClick={next}>Record payment</Button></>}>
      {sure ? <Notice tone="warn">Record <b>{money(+amt, inv.cur)}</b> from {inv.uniName} against {inv.no}, received {nice(on)}, reference {ref.trim()}? Its {inv.lines.length} line{inv.lines.length === 1 ? '' : 's'} become Paid{diff ? `, with a difference of ${money(diff, inv.cur)} (${reason})` : ''}, and the RPs’ shares become ready to pay. This can’t be undone here.</Notice> : <>
      <Field id="up-a" label={`Amount received (${inv.cur})`} required><NumberInput id="up-a" value={amt} onChange={setAmt} /></Field>
      <Field id="up-on" label="Received on" required><DateField id="up-on" value={on} onChange={setOn} /></Field>
      <Field id="up-r" label="Remittance or bank reference" required><Input id="up-r" value={ref} onChange={setRef} /></Field>
      {diff !== 0 && <Select id="up-why" label={`Why it’s ${diff < 0 ? 'short' : 'more'} by ${money(Math.abs(diff), inv.cur)}`} required value={reason} onChange={setReason} placeholder="Choose a reason" options={ops.diffReasons.map((r) => [r, r])} />}
      </>}
    </Sheet>
  );
}

/** Resolve a payment difference: settled (the university paid the rest, or it was explained) or written off. */
export function FixSheet({ d, user, onClose }) {
  const [how, setHow] = useState('');
  const [note, setNote] = useState('');
  const go = () => {
    if (!how) { toast('Choose how it’s resolved.'); return; }
    update((x) => { const y = x.comm.diffs.find((z) => z.id === d.id); Object.assign(y, { status: how, note: note.trim(), doneBy: user.name, doneAt: Date.now() }); const i = x.comm.uniInv[d.inv]; if (i) i.status = 'paid'; }, `${user.name} ${how === 'written off' ? 'wrote off' : 'resolved'} the difference on ${d.inv}`);
    toast(how === 'written off' ? 'Written off' : 'Resolved'); onClose();
  };
  return (
    <Sheet title={`Difference on ${d.inv}`} sub={`${d.uniName} · ${money(r2(d.received - d.expected), d.cur)} · ${d.reason}`} onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button kind="primary" onClick={go}>Save</Button></>}>
      <Select id="fx-h" label="How it’s resolved" required value={how} onChange={setHow} placeholder="Choose" options={[['resolved', 'Resolved: paid or explained'], ['written off', 'Write off the difference']]} />
      <Field id="fx-n" label="Note" hint="What happened"><Input id="fx-n" value={note} onChange={setNote} /></Field>
    </Sheet>
  );
}
