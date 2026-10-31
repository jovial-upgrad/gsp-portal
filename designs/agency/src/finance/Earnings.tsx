// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Earnings (RP side). Replaces the designer's "Earnings is designed next" page.
 * What the agency has earned, what's in the next Thursday payout, what's waiting
 * for the university to pay GSP, and what will be recovered. Shows only the
 * RP's own amounts and rate: never GSP's commission or the university's rate.
 */
import React, { useState } from 'react';
import { update } from './store';
import { can } from './access';
import { Page, Card, Tiles, Segmented, Table, Pill, Button, LinkButton, Sheet, Empty, Notice, Field, Input, toast } from './kit';
import { PersonaBar, usePersona } from './persona';
import { nice, money, bandTxt, winName, windowKey, thursdayOf } from './engine';
import { useComm, liveRun, convert, sum } from './shared';

const SHOW = [['', 'All'], ['next', 'In the next payout'], ['wait', 'Waiting for the university'], ['paid', 'Paid'], ['recover', 'To be recovered']];

export default function Earnings() {
  const { s, c, cfg, res } = useComm();
  const { user, role } = usePersona();
  const [f, setF] = useState('');
  const [bank, setBank] = useState(false);
  if (!can(s.matrix, role.id, 'earnings')) {
    return <Page title="Earnings" top={<PersonaBar />}><Card><Empty title={`${role.name}s don’t see earnings`}>Your RP Admin sees the agency’s commission and payouts.</Empty></Card></Page>;
  }
  const rp = cfg.rps.find(r => r.name === user.agency);
  if (!rp) return <Page title="Earnings" top={<PersonaBar />}><Card><Empty title="No commission terms yet">GSP Finance hasn’t entered your agency’s terms. Your BDM can help.</Empty></Card></Page>;

  const cur = rp.cur || 'AUD';
  const today = c.today; const thu = thursdayOf(today);
  const mine = res.rp.filter(x => (x.r.payee || x.r.rp).id === rp.id);
  const inCur = (amt, from) => convert(cfg, amt, from, cur, today);
  const rows = mine.map(x => {
    const state = x.due < 0 ? 'recover' : x.payable && x.due > 0 ? 'next' : x.st[0] === 'Paid' ? 'paid' : x.st[0] === 'Waiting for university payment' ? 'wait' : 'other';
    return { x, state, amt: inCur(x.ent, x.cur), paid: inCur(x.paid, x.cur), due: inCur(x.due, x.cur) };
  });
  const by = k => rows.filter(r => r.state === k);
  const run = liveRun(c, res); const inv = run.invoices[rp.id]; const myRun = run.payees[rp.id];
  const canAct = can(s.matrix, role.id, 'earnings', 'U');
  const canBank = can(s.matrix, role.id, 'bank', 'U');

  /* Tier progress for the current counting window */
  const sch = rp.flat != null && rp.flat !== '' ? null : cfg.schemes.find(x => x.id === rp.scheme);
  let tier = null;
  if (sch && sch.type === 'tier') {
    const wk = windowKey(sch.window, today);
    const n = new Set(mine.filter(x => x.r.counts && windowKey(sch.window, x.r.received) === wk && !x.r.boxed && !x.a.gspLead).map(x => x.app)).size;
    const band = sch.bands.findIndex(b => n >= b[0] && (b[1] == null || n <= b[1]));
    const nextB = sch.bands[Math.max(0, band) + 1];
    tier = { wk, n, pct: sch.bands[Math.max(0, band)][2], next: nextB, need: nextB ? nextB[0] - n : 0 };
  }

  const n0 = v => Math.round(v).toLocaleString(cur === 'INR' ? 'en-IN' : 'en-AU');
  const tiles = [
    { id: 'paid', n: n0(sum(by('paid'), r => r.paid)), label: `Paid to you (${cur})`, sub: `${by('paid').length} payments`, tone: 'gsp' },
    { id: 'next', n: n0(sum(by('next'), r => r.due)), label: `In the payout on ${nice(thu)} (${cur})`, sub: `${by('next').length} payments, before recoveries and withholding`, tone: 'you' },
    { id: 'wait', n: n0(sum(by('wait'), r => r.amt)), label: `Waiting for the university (${cur})`, sub: 'Paid after the university pays GSP', tone: 'gsp' },
    { id: 'recover', n: n0(-sum(by('recover'), r => r.due)), label: `To be recovered (${cur})`, sub: 'Student withdrew with a refund', tone: 'bad' },
  ];
  const list = rows.filter(r => r.state !== 'other' && (!f || r.state === f));
  const LABEL = { next: ['In next payout', 'dpill--checking'], wait: ['Waiting for the university', ''], paid: ['Paid', 'dpill--verified'], recover: ['To be recovered', 'dpill--bad'] };

  return (
    <Page title="Earnings" top={<PersonaBar />} lead={`Commission for ${rp.name}, paid every Thursday in ${cur} once the university has paid GSP.`}>
      <Tiles items={tiles} value={f || null} onChange={v => setF(v || '')} />
      {inv && myRun && (
        <Card>
          <h2 className="gspx-h3">Invoice {inv.no} for the payout on {nice(run.date)}</h2>
          <p>GSP has raised this invoice on your behalf (recipient-created tax invoice) for <b className="num">{Object.entries(myRun.total).map(([k, v]) => money(v, k)).join(' + ')}</b>, {myRun.lines.length} payments. Check it and approve it to be paid on Thursday.</p>
          {inv.status === 'sent' && canAct ? <div className="gspx-inline">
            <Button kind="primary" onClick={() => update(d => { d.comm.run.invoices[rp.id].status = 'approved'; }, `${user.name} (${rp.name}) approved invoice ${inv.no}`) || toast('Approved. It will be paid on Thursday.')}>Approve invoice</Button>
            <Button onClick={() => update(d => { d.comm.run.invoices[rp.id].status = 'queried'; d.tasks.unshift({ id: 'T-Q-' + inv.no, record: 'cm-payout', kind: 'k-exception', queue: 'q-finance', title: `${rp.name} queried invoice ${inv.no}`, created: Date.now(), status: 'open' }); }, `${user.name} (${rp.name}) queried invoice ${inv.no}`) || toast('Sent to GSP Finance. They’ll reply in the portal.')}>Something’s wrong</Button>
          </div> : <Pill tone={inv.status === 'approved' ? 'dpill--verified' : 'dpill--bad'}>{inv.status === 'approved' ? 'You approved it' : 'You queried it: Finance will reply'}</Pill>}
        </Card>)}
      <div className="gspx-grid2">
        <Card>
          <h2 className="gspx-h3">Your commission terms</h2>
          {sch ? <>
            <p>{sch.type === 'flat' ? `${sch.flat}% flat.` : `${bandTxt(sch.bands)}, counted per ${winName[sch.window] || sch.window}, ${sch.retro === 'yes' ? 'and the higher rate applies to every enrolment in the period' : sch.retro === 'top' ? 'and the top rate applies to every enrolment once reached' : 'and the higher rate applies from the next enrolment'}.`}</p>
            {tier && <p className="gspx-sentence">{tier.wk}: <b className="num">{tier.n}</b> paid enrolments so far, so your rate is <b>{tier.pct}%</b>.{tier.next ? ` ${tier.need} more to reach ${tier.next[2]}%.` : ' You’re in the top band.'} An enrolment counts once the university has paid GSP.</p>}
          </> : <p>{rp.flat}% flat.</p>}
          <p className="muted">Rates are a percentage of the commission GSP receives. Notices and promotions may pay more for some enrolments; those show on each payment.</p>
        </Card>
        <Card>
          <h2 className="gspx-h3">Where we pay</h2>
          <p>{rp.bank === 'AU' ? 'Australian bank account' : 'Local bank account'} in {cur}. Account ending <span className="num">••4821</span>.</p>
          {rp.bankVerified === false ? <Notice tone="warn">New bank details are waiting for GSP to verify them. Payouts are held until then.</Notice> : <p className="muted">Verified by GSP Finance.</p>}
          {canBank && <div><Button onClick={() => setBank(true)}>Change bank details</Button></div>}
        </Card>
      </div>
      <Card flush>
        <div className="stools"><div className="stools__row"><Segmented label="Show" options={SHOW} value={f} onChange={setF} /></div>
          <p className="stools__count"><span><span className="num">{list.length}</span> payments</span></p></div>
        <Table head={['Student', 'University', 'Payment', 'Your rate', `Amount (${cur})`, 'Status']}
          empty={!list.length && <Empty title="Nothing here yet">Commission appears once a student enrols.</Empty>}>
          {list.map(({ x, state, amt, due }) => (
            <tr key={x.app + x.key} className="irow">
              <td>{x.a.student}<span className="irow__sub">{x.app}</span></td>
              <td>{x.r.u.name}<span className="irow__sub">Course start {nice(x.a.intake)}</span></td>
              <td>{x.label.replace('Commission, instalment', 'Instalment')}{x.r.notice?.pct && x.kind === 'pct' && !x.a.gspLead ? <span className="irow__sub">{x.r.notice.pct.name}</span> : x.a.gspLead ? <span className="irow__sub">GSP lead</span> : null}</td>
              <td className="num">{x.kind === 'pct' ? `${x.lp}%` : 'Bonus'}</td>
              <td className="num">{state === 'recover' ? money(due, cur) : money(amt, cur)}</td>
              <td><Pill tone={LABEL[state][1]}>{LABEL[state][0]}</Pill>{state === 'wait' && <span className="irow__sub">{x.ip?.st[0] === 'Not yet due' ? `University pays after ${nice(x.ip.date)}` : 'University invoiced'}</span>}</td>
            </tr>))}
        </Table>
      </Card>
      {bank && <BankSheet rp={rp} user={user} onClose={() => setBank(false)} />}
    </Page>
  );
}

function BankSheet({ rp, user, onClose }) {
  const [d, setD] = useState({ name: '', no: '', code: '' });
  const ok = d.name && d.no && d.code;
  const save = () => {
    update(x => {
      x.comm.cfg.rps.find(r => r.id === rp.id).bankVerified = false;
      x.tasks.unshift({ id: 'T-BANK-' + Date.now(), record: 'cm-payout', kind: 'k-exception', queue: 'q-finance', title: `Verify new bank details for ${rp.name}`, created: Date.now(), status: 'open' });
    }, `${user.name} changed ${rp.name}’s bank details (waiting for Finance to verify)`);
    toast('Sent to GSP Finance. Payouts are held until they verify the new account.'); onClose();
  };
  return (
    <Sheet title="Change bank details" sub="GSP Finance verifies new details before the next payout" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button kind="primary" disabled={!ok} onClick={save}>Send to GSP</Button></>}>
      <Field id="b-n" label="Account name" required><Input id="b-n" value={d.name} onChange={v => setD({ ...d, name: v })} /></Field>
      <Field id="b-no" label="Account number" required><Input id="b-no" value={d.no} onChange={v => setD({ ...d, no: v })} /></Field>
      <Field id="b-c" label={rp.bank === 'AU' ? 'BSB' : 'Bank code (IFSC, SWIFT or routing)'} required><Input id="b-c" value={d.code} onChange={v => setD({ ...d, code: v })} /></Field>
      <Notice>Upload a bank letter or cancelled cheque in Profile › Documents so Finance can verify it.</Notice>
    </Sheet>
  );
}
