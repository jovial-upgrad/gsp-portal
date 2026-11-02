// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Earnings (RP side). Replaces the designer's "Earnings is designed next" page.
 * What the agency has earned, what's in the next payout (on Finance's pay day), what's waiting
 * for the university to pay GSP, and what will be recovered. Shows only the
 * RP's own amounts and rate: never GSP's commission or the university's rate.
 */
import React, { useState } from 'react';
import { update } from './store';
import { can } from './access';
import { Page, Card, Tiles, Segmented, Table, Pill, Button, LinkButton, Sheet, Empty, Notice, Field, Input, toast } from './kit';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useCheck } from '../components/validate';
import { fmtAmount } from '../data/format';
import { PersonaBar, usePersona } from './persona';
import { nice, money, bandTxt, winName, windowKey, thursdayOf } from './engine';
import { useComm, liveRun, convert, sum, payDayName } from './shared';
import { FileDrop } from '../components/FileDrop';

const SHOW = [['', 'All'], ['next', 'In the next payout'], ['approved', 'Approved'], ['wait', 'Waiting for the university'], ['paid', 'Paid'], ['recover', 'To be recovered']];

/** Why a payment is at its rate (W27): which enrolment it is in the counting window, from Finance's own working. */
function rateWhy(x) {
  const t = x.r && x.r.rpTier;
  if (x.a.gspLead) return 'GSP lead: flat rate';
  if (x.annuity) return 'Annuity rate';
  if (x.r && x.r.rpSrc && x.r.rpSrc !== 'scheme') return x.r.rpSrc.replace(/^scheme\+/, 'Scheme plus notice ');
  if (!t) return 'Your flat rate';
  return t.est ? `Estimate: enrolment ${t.rank} in ${t.wk}` : `Enrolment ${t.rank} of ${t.total} in ${t.wk}`;
}

export default function Earnings() {
  const { s, c, cfg, res } = useComm();
  const { user, role } = usePersona();
  const [f, setF] = useState('');
  const [bank, setBank] = useState(false);
  if (!can(s.matrix, role.id, 'earnings')) {
    return <Page title="Earnings" top={<PersonaBar />}><Card><Empty title={`${role.name}s don’t see earnings`}>Your RP Admin sees the agency’s commission and payouts.</Empty></Card></Page>;
  }
  const rp = cfg.rps.find(r => r.name === user.agency);
  if (!rp) return <Page title="Earnings" top={<PersonaBar />}><Card><Empty title="No commission terms yet">GSP Finance hasn’t entered your agency’s terms. Your Recruitment contact at GSP can help.</Empty></Card></Page>;

  const cur = rp.cur || 'AUD';
  const today = c.today; const thu = thursdayOf(today, cfg); const payDay = payDayName(cfg);
  const mine = res.rp.filter(x => (x.r.payee || x.r.rp).id === rp.id);
  const inCur = (amt, from) => convert(cfg, amt, from, cur, today);
  // W13: a line in a run Finance has approved is Approved until pay day, then Paid
  const approvedRuns = (c.runs || []).filter(r => r.status === 'approved');
  const inApproved = x => approvedRuns.find(r => (r.lines || []).some(L => L.app === x.app && L.key === x.key));
  const rows = mine.map(x => {
    const ar = inApproved(x);
    const state = ar ? 'approved' : x.due < 0 ? 'recover' : x.payable && x.due > 0 ? 'next' : x.st[0] === 'Paid' ? 'paid' : x.st[0] === 'Waiting for university payment' ? 'wait' : 'other';
    return { x, state, ar, amt: inCur(x.ent, x.cur), paid: inCur(x.paid, x.cur), due: inCur(x.due, x.cur) };
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

  // never "-0" (QC, 1 Nov): rounded first, in the currency's grouping
  const n0 = v => fmtAmount(v, cur, 0);
  const tiles = [
    { id: 'paid', n: n0(sum(by('paid'), r => r.paid)), label: `Paid to you (${cur})`, sub: `${by('paid').length} payments`, tone: 'gsp' },
    { id: 'next', n: n0(sum([...by('next'), ...by('approved')], r => r.due)), label: `In the payout on ${nice(thu)} (${cur})`, sub: by('approved').length ? `${by('approved').length} approved by GSP, paid on ${nice(thu)}` : `${by('next').length} payments, before recoveries and withholding`, tone: 'you' },
    { id: 'wait', n: n0(sum(by('wait'), r => r.amt)), label: `Waiting for the university (${cur})`, sub: 'Paid after the university pays GSP', tone: 'gsp' },
    { id: 'recover', n: n0(-sum(by('recover'), r => r.due) || 0), label: `To be recovered (${cur})`, sub: 'Student withdrew with a refund', tone: 'bad' },
  ];
  const list = rows.filter(r => r.state !== 'other' && (!f || r.state === f));
  const LABEL = { next: ['In next payout', 'dpill--checking'], approved: ['Approved', 'dpill--checking'], wait: ['Waiting for the university', ''], paid: ['Paid', 'dpill--verified'], recover: ['To be recovered', 'dpill--bad'] };

  return (
    <Page title="Earnings" top={<PersonaBar />} lead={`Commission for ${rp.name}, paid every ${payDay} in ${cur} once the university has paid GSP.`}>
      <Tiles items={tiles} value={f || null} onChange={v => setF(v || '')} />
      {inv && myRun && (
        <Card>
          <h2 className="gspx-h3">Invoice {inv.no} for the payout on {nice(run.date)}</h2>
          <p>GSP has raised this invoice on your behalf (recipient-created tax invoice) for <b className="num">{Object.entries(myRun.total).map(([k, v]) => money(v, k)).join(' + ')}</b>, {myRun.lines.length} payments. Check it and approve it to be paid on {payDay}.</p>
          {inv.status === 'sent' && canAct ? <div className="gspx-inline">
            <Button kind="primary" onClick={() => update(d => { d.comm.run.invoices[rp.id].status = 'approved'; }, `${user.name} (${rp.name}) approved invoice ${inv.no}`) || toast(`Approved. It will be paid on ${payDay}.`)}>Approve invoice</Button>
            <Button onClick={() => update(d => { d.comm.run.invoices[rp.id].status = 'queried'; d.tasks.unshift({ id: 'T-Q-' + inv.no, record: 'cm-payout', kind: 'k-exception', queue: 'q-finance', title: `${rp.name} queried invoice ${inv.no}`, created: Date.now(), status: 'open' }); }, `${user.name} (${rp.name}) queried invoice ${inv.no}`) || toast('Sent to GSP Finance. They’ll reply in the portal.')}>Something’s wrong</Button>
          </div> : <Pill tone={inv.status === 'approved' || inv.status === 'paying' ? 'dpill--verified' : 'dpill--bad'}>{inv.status === 'paying' ? `Approved by GSP: paid on ${nice(run.date)}` : inv.status === 'approved' ? 'You approved it' : 'You queried it: Finance will reply'}</Pill>}
        </Card>)}
      <div className="gspx-grid2">
        <Card>
          <h2 className="gspx-h3">Your commission terms</h2>
          {sch ? <>
            <p>{sch.type === 'flat' ? `${sch.flat}% flat.` : `${bandTxt(sch.bands)}, counted per ${winName[sch.window] || sch.window}, ${sch.retro === 'yes' ? 'and the higher rate applies to every enrolment in the period' : sch.retro === 'top' ? 'and the top rate applies to every enrolment once reached' : 'and the higher rate applies from the next enrolment'}.`}</p>
            {tier && <p className="gspx-sentence">{tier.wk}: <b className="num">{tier.n}</b> enrolments GSP has been paid for{tier.n ? <>, at up to <b>{tier.pct}%</b></> : ''}. {tier.next ? (tier.need === 1 ? <>Your next enrolment is number {tier.n + 1}, at <b>{tier.next[2]}%</b>: payments still waiting for the university show that rate as an estimate.</> : `${tier.need} more to reach ${tier.next[2]}%.`) : 'You’re in the top band.'} An enrolment counts once the university has paid GSP; each payment below says which one it is.</p>}
          </> : <p>{rp.flat}% flat.</p>}
          <p className="muted">Rates are a percentage of the commission GSP receives. Notices and promotions may pay more for some enrolments; those show on each payment.</p>
        </Card>
        <Card>
          <h2 className="gspx-h3">Where we pay</h2>
          <p>{rp.bank === 'AU' ? 'Australian bank account' : 'Local bank account'} in {cur}.{rp.bankLast4 ? <> Account ending <span className="num">••{rp.bankLast4}</span>.</> : ' The account on file with GSP Finance.'}</p>
          {rp.bankVerified === false ? <Notice tone="warn">New bank details are waiting for GSP to verify them. Payouts are held until then.</Notice> : <p className="muted">Verified by GSP Finance.</p>}
          {canBank && <div><Button onClick={() => setBank(true)}>Change bank details</Button></div>}
        </Card>
      </div>
      <Card flush>
        <div className="stools"><div className="stools__row"><Segmented label="Show" options={SHOW} value={f} onChange={setF} /></div>
          <p className="stools__count"><span><span className="num">{list.length}</span> payments</span></p></div>
        <Table head={['Student', 'University', 'Payment', 'Your rate', `Amount (${cur})`, 'Status']}
          empty={!list.length && <Empty title="Nothing here yet">Commission appears once a student enrols.</Empty>}>
          {list.map(({ x, state, ar, amt, due }) => (
            <tr key={x.app + x.key} className="irow">
              <td>{x.a.student}<span className="irow__sub">{x.app}</span></td>
              <td>{x.r.u.name}<span className="irow__sub">Course start {nice(x.a.intake)}</span></td>
              <td>{x.label.replace('Commission, instalment', 'Instalment')}{x.r.notice?.pct && x.kind === 'pct' && !x.a.gspLead ? <span className="irow__sub">{x.r.notice.pct.name}</span> : x.a.gspLead ? <span className="irow__sub">GSP lead</span> : null}</td>
              <td className="num">{x.a.withdrawn && state === 'recover' ? <>—<span className="irow__sub">Paid earlier, recovered in full</span></> : <>{x.kind === 'pct' ? `${x.lp}%` : 'Bonus'}{x.kind === 'pct' && <span className="irow__sub">{rateWhy(x)}</span>}</>}</td>
              <td className="num">{state === 'recover' ? money(due, cur) : money(amt, cur)}</td>
              <td><Pill tone={LABEL[state][1]}>{state === 'recover' && x.a.withdrawn ? 'Clawback' : LABEL[state][0]}</Pill>{state === 'recover' && x.a.withdrawn && <span className="irow__sub">Withdrew {nice(x.a.withdrawn.date)} after enrolling{x.a.withdrawn.refund ? ', with a refund' : ''}: taken from your next payout</span>}{state === 'approved' && <span className="irow__sub">Paid on {nice(ar.date)}</span>}{state === 'wait' && <span className="irow__sub">{x.ip?.st[0] === 'Not yet due' ? `University pays after ${nice(x.ip.date)}` : 'University invoiced'}</span>}</td>
            </tr>))}
        </Table>
      </Card>
      {bank && <BankSheet rp={rp} user={user} onClose={() => setBank(false)} />}
    </Page>
  );
}

/* QC, 1 Nov: what the bank code looks like for the account's country, and the account number. */
const CODE = {
  AU: { label: 'BSB', hint: '6 digits, like 062-000', ok: v => /^\d{3}-?\d{3}$/.test(v), msg: 'Enter the BSB: 6 digits, like 062-000.' },
  IN: { label: 'IFSC', hint: '11 characters, like HDFC0001234', ok: v => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase()), msg: 'Enter the IFSC: 4 letters, a 0, then 6 letters or digits, like HDFC0001234.' },
  SWIFT: { label: 'SWIFT code', hint: '8 or 11 characters, like NABLNPKA', ok: v => /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v.toUpperCase()), msg: 'Enter the SWIFT code: 8 or 11 letters and digits, like NABLNPKA.' },
};
const ACCT = {
  AU: { ok: v => /^\d{6,10}$/.test(v), msg: 'Enter the account number: 6 to 10 digits.' },
  IN: { ok: v => /^\d{9,18}$/.test(v), msg: 'Enter the account number: 9 to 18 digits.' },
  SWIFT: { ok: v => /^[A-Z0-9]{6,34}$/i.test(v), msg: 'Enter the account number: 6 to 34 letters and digits.' },
};

export function BankSheet({ rp, user, onClose }) {
  const kind = rp.bank === 'AU' ? 'AU' : rp.cur === 'INR' || rp.region === 'India' ? 'IN' : 'SWIFT';
  const code = CODE[kind];
  const [d, setD] = useState({ name: '', no: '', no2: '', code: '', letter: '' });
  const [sure, setSure] = useState(false);
  const no = d.no.replace(/\s/g, '');
  const errors = {
    name: !d.name.trim() ? 'Enter the account name, as the bank has it.' : null,
    no: !no ? 'Enter the account number.' : ACCT[kind].ok(no) ? null : ACCT[kind].msg,
    no2: !d.no2 ? 'Type the account number again.' : d.no2.replace(/\s/g, '') !== no ? 'The account numbers don’t match. Check both.' : null,
    code: !d.code.trim() ? `Enter the ${code.label}.` : code.ok(d.code.trim()) ? null : code.msg,
    letter: !d.letter ? 'Upload a bank letter or a cancelled cheque for this account.' : null,
  };
  const v = useCheck(errors);
  const empty = !d.name.trim() || !no || !d.no2 || !d.code.trim() || !d.letter;
  const dirty = !!(d.name || d.no || d.no2 || d.code || d.letter);
  const send = () => {
    update(x => {
      { const t = x.comm.cfg.rps.find(r => r.id === rp.id); t.bankVerified = false; t.bankLast4 = no.slice(-4); t.bankName = d.name.trim(); }
      x.tasks.unshift({ id: 'T-BANK-' + Date.now(), record: 'cm-payout', kind: 'k-exception', queue: 'q-finance', title: `Verify new bank details for ${rp.name}`, note: `Bank letter: ${d.letter}. Check the account name and number against it.`, maker: user.id, created: Date.now(), status: 'open' });
    }, `${user.name} changed ${rp.name}’s bank details (waiting for Finance to verify)`);
    toast('Bank details sent', { text: 'GSP Finance verifies the new account. Payouts are held until then.' }); onClose();
  };
  const set = (k, x) => setD({ ...d, [k]: x });
  return (
    <>
      <Sheet title="Change bank details" sub="GSP Finance verifies new details before the next payout" onClose={onClose} dirty={dirty} what="the bank details"
        footer={<>{empty && <span className="muted gspx-grow" id="b-why">Fill in every field and add the bank letter to send.</span>}<Button onClick={onClose}>Cancel</Button><Button kind="primary" disabled={empty} aria-describedby={empty ? 'b-why' : undefined} onClick={() => v.submit() && setSure(true)}>Send to GSP</Button></>}>
        <Field id="b-n" label="Account name" required error={v.err('name')}><Input id="b-n" value={d.name} onBlur={v.blur('name')} onChange={x => set('name', x)} /></Field>
        <Field id="b-no" label="Account number" required error={v.err('no')}><Input id="b-no" inputMode={kind === 'SWIFT' ? 'text' : 'numeric'} autoComplete="off" value={d.no} onBlur={v.blur('no')} onChange={x => set('no', x)} /></Field>
        <Field id="b-no2" label="Account number again" required error={v.err('no2')} hint="Type it again, so a slip doesn’t send your commission to the wrong account."><Input id="b-no2" inputMode={kind === 'SWIFT' ? 'text' : 'numeric'} autoComplete="off" onPaste={e => e.preventDefault()} value={d.no2} onBlur={v.blur('no2')} onChange={x => set('no2', x)} /></Field>
        <Field id="b-c" label={code.label} required error={v.err('code')} hint={code.hint}><Input id="b-c" autoComplete="off" value={d.code} onBlur={v.blur('code')} onChange={x => set('code', kind === 'AU' ? x : x.toUpperCase())} /></Field>
        <Field id="b-letter" label="Bank letter or cancelled cheque" required error={v.err('letter')} hint="GSP Finance checks the account against it (H40, 1 Nov). PDF or a photo.">
          <FileDrop id="b-letter" accept=".pdf,image/*" file={d.letter || undefined} invalid={!!v.err('letter')} describedBy={v.err('letter') ? 'b-letter-error' : 'b-letter-hint'}
            label="Drag the letter here, or" onFiles={f => set('letter', f[0]?.name || '')} onRemove={() => set('letter', '')} />
        </Field>
      </Sheet>
      <ConfirmDialog open={sure} title="Hold payouts until GSP verifies?" confirm="Send and hold payouts" onCancel={() => setSure(false)} onConfirm={() => { setSure(false); send(); }}>
        <p>Your payouts stop until GSP Finance verifies the new account. Anything due before then waits for the next payout after it.</p>
      </ConfirmDialog>
    </>
  );
}
