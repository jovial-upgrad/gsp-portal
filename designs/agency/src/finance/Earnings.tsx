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
import { Page, Card, Tiles, Segmented, Table, Pill, Button, LinkButton, Sheet, Empty, Notice, Field, Input, DateField, toast } from './kit';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useCheck } from '../components/validate';
import { fmtAmount } from '../data/format';
import { PersonaBar, usePersona } from './persona';
import { nice, money, bandTxt, winName, windowKey, r2 } from './engine';
import { useComm, liveRun, convert, sum, payDayName, cycleOf } from './shared';
import { rpLineStatus, LINE_STATUS, INV_STATUS, newInvoice, invoiceHtml, downloadFile, effectivePct } from './rpInvoice';
import { FileDrop } from '../components/FileDrop';

const SHOW = [['', 'All'], ['ready', 'Ready to invoice'], ['review', 'Invoice in review'], ['approved', 'Approved'], ['wait', 'Waiting for the university'], ['expected', 'Expected'], ['paid', 'Paid'], ['recover', 'Recovered']];

/** Why a payment is at its rate (W27): which enrolment it is in the counting window, from Finance's own working. */
function rateWhy(x) {
  const t = x.r && x.r.rpTier;
  if (x.a.gspLead) return 'GSP lead: flat rate';
  if (x.annuity) return 'Annuity rate';
  if (x.r && x.r.rpSrc && x.r.rpSrc !== 'scheme') return x.r.rpSrc.replace(/^scheme\+/, 'Scheme plus notice ');
  if (!t) return 'Your flat rate';
  return t.est ? `Estimate: enrolment ${t.rank} in ${t.wk}` : `Enrolment ${t.rank} of ${t.total} in ${t.wk}`;
}

/**
 * Earnings (RP Admin only; Jovial, 5 Nov: Commissions flow Q11–Q23). Every commission line with its status, how it's
 * worked out (the fee, the RP's effective % of it, its tier band; never GSP's rate or amount), and the month's invoice:
 * download the system invoice, add your number, sign and upload it; GSP checks it and pays by the cycle's pay-by day.
 */
export default function Earnings() {
  const { s, c, cfg, res } = useComm();
  const { user, role } = usePersona();
  const [f, setF] = useState('');
  const [bank, setBank] = useState(false);
  const [upload, setUpload] = useState(false);
  const [why, setWhy] = useState(null);
  const [ask, setAsk] = useState(null);
  if (!can(s.matrix, role.id, 'earnings')) {
    return <Page title="Earnings" top={<PersonaBar />}><Card><Empty title={`${role.name}s don’t see earnings`}>Your RP Admin sees the agency’s commission and payouts.</Empty></Card></Page>;
  }
  const rp = cfg.rps.find(r => r.name === user.agency);
  if (!rp) return <Page title="Earnings" top={<PersonaBar />}><Card><Empty title="No commission terms yet">GSP Finance hasn’t entered your agency’s terms. Your Recruitment contact at GSP can help.</Empty></Card></Page>;

  const cur = rp.cur || 'AUD';
  const today = c.today; const payDay = payDayName(cfg);
  const cyc = cycleOf(cfg, today);
  const mine = res.rp.filter(x => (x.r.payee || x.r.rp).id === rp.id);
  const inCur = (amt, from) => convert(cfg, amt, from, cur, today);
  const run = liveRun(c, res);
  // on hold: new bank details not verified yet, or no rate this week for the line's or the payout's currency
  const heldFor = x => rp.bankVerified === false || run.hold.includes(x.cur) || run.hold.includes(cur);
  const held = rp.bankVerified === false || run.hold.includes(cur);
  const rows = mine.map(x => {
    const state = rpLineStatus(c, x, today, heldFor(x));
    return { x, state, amt: inCur(x.ent, x.cur), paid: inCur(x.paid, x.cur), due: inCur(x.due, x.cur) };
  });
  const by = k => rows.filter(r => r.state === k);
  const canAct = can(s.matrix, role.id, 'earnings', 'U');
  const canBank = can(s.matrix, role.id, 'bank', 'U');
  const myInv = Object.values(c.rpInv || {}).filter(i => i.rp === rp.id).sort((a, b) => b.made - a.made);
  const open = myInv.find(i => i.status !== 'paid');
  const fresh = !open && run.payees[rp.id] ? newInvoice(c, run, rp, user) : null;
  const queries = (c.queries || []).filter(q => q.rp === rp.id && q.status === 'open');

  /* Tier progress for the current counting window: enrolled students GSP will be paid for (Q9) */
  const sch = rp.flat != null && rp.flat !== '' ? null : cfg.schemes.find(x => x.id === rp.scheme);
  let tier = null;
  if (sch && sch.type === 'tier') {
    const wk = windowKey(sch.window, today);
    const n = new Set(mine.filter(x => windowKey(sch.window, x.a.intake) === wk && !x.r.boxed && !x.a.gspLead && !(x.a.withdrawn && !x.r.received)).map(x => x.app)).size;
    const band = sch.bands.findIndex(b => n >= b[0] && (b[1] == null || n <= b[1]));
    const nextB = sch.bands[Math.max(0, band) + 1];
    tier = { wk, n, pct: sch.bands[Math.max(0, band)][2], next: nextB, need: nextB ? nextB[0] - n : 0 };
  }

  const download = () => {
    const inv = open || fresh; if (!inv) return;
    if (!open) update(d => { d.comm.rpInv = { ...(d.comm.rpInv || {}), [inv.id]: inv }; }, `${user.name} (${rp.name}) downloaded invoice ${inv.ref} for ${inv.cycleLabel}`);
    downloadFile(`${inv.ref}.html`, invoiceHtml(inv, rp));
    toast('Invoice downloaded', { text: 'Add your invoice number and date, sign it, and upload it here.' });
  };

  const n0 = v => fmtAmount(v, cur, 0);
  const tiles = [
    { id: 'paid', n: n0(sum(by('paid'), r => r.paid || r.amt)), label: `Paid to you (${cur})`, sub: `${by('paid').length} payments`, tone: 'gsp' },
    { id: 'ready', n: n0(sum([...by('ready'), ...by('sentback')], r => r.due)), label: `Ready to invoice (${cur})`, sub: `For ${cyc.label}, paid by ${nice(cyc.payBy)}`, tone: 'gsp' },
    { id: 'review', n: n0(sum([...by('review'), ...by('approved')], r => r.due)), label: `Invoiced (${cur})`, sub: by('approved').length ? `${by('approved').length} approved, paid by ${nice(open?.payBy || cyc.payBy)}` : 'With GSP Finance to check', tone: 'gsp' },
    { id: 'wait', n: n0(sum([...by('wait'), ...by('expected')], r => r.amt)), label: `Waiting for the university (${cur})`, sub: 'Paid after the university pays GSP', tone: 'gsp' },
    { id: 'recover', n: n0(-sum(by('recover'), r => r.due) || 0), label: `To be recovered (${cur})`, sub: 'Taken from your next payout', tone: 'bad' },
  ];
  const list = rows.filter(r => !f || r.state === f || (f === 'ready' && r.state === 'sentback') || (f === 'wait' && r.state === 'hold'));
  const inv = open;

  return (
    <Page title="Earnings" top={<PersonaBar />} lead={`Commission for ${rp.name}, in ${cur}. Once the university pays GSP, a line is ready to invoice. Invoice once a month; GSP pays by ${payDay}.`}>
      <Tiles items={tiles} value={f || null} onChange={v => setF(v || '')} />
      {(inv || fresh) && (
        <Card>
          <div className="gspx-row"><div className="gspx-grow">
            <h2 className="gspx-h3">{inv ? `Invoice for ${inv.cycleLabel}` : `Invoice for ${cyc.label}`}</h2>
            {inv && <p><Pill tone={INV_STATUS[inv.status][1]}>{INV_STATUS[inv.status][0]}</Pill> <span className="muted">System reference {inv.ref}{inv.rpNo ? ` · your number ${inv.rpNo}` : ''} · to {inv.entity?.name}</span></p>}
          </div></div>
          <p>{(inv || fresh).lines.length} lines · {Object.entries((inv || fresh).byCur).map(([k, v]) => `${money(v.net, k)} commission${v.gst ? ` + ${money(v.gst, k)} tax` : ''}${v.wht ? ` − ${money(v.wht, k)} withheld` : ''} = ${money(r2(v.net + v.gst - v.wht), k)}`).join('; ')}. Paid by {nice((inv || fresh).payBy)}.</p>
          {inv?.status === 'sentback' && <Notice tone="warn">GSP sent it back: {inv.reason}{inv.note ? `. ${inv.note}` : ''}. Fix it and upload it again.</Notice>}
          {inv?.status === 'review' && <p className="muted">Uploaded {nice(new Date(inv.uploadedAt).toISOString().slice(0, 10))}. GSP Finance is checking it.</p>}
          {inv?.status === 'approved' && <p className="muted">Approved by GSP. It’s paid by {nice(inv.payBy)} to the account ending ••{rp.bankLast4 || '····'}.</p>}
          {canAct && (!inv || inv.status === 'draft' || inv.status === 'sentback') && (
            <div className="gspx-inline">
              <Button onClick={download}>Download invoice</Button>
              {inv && <Button kind="primary" onClick={() => setUpload(true)}>Upload signed invoice</Button>}
              {held && <span className="muted">Payouts are on hold until {rp.bankVerified === false ? 'GSP verifies your new bank details' : 'this month’s exchange rate is entered'}.</span>}
            </div>)}
          {!canAct && <p className="muted">Only your RP Admin can invoice.</p>}
        </Card>)}
      <div className="gspx-grid2">
        <Card>
          <h2 className="gspx-h3">Your commission terms</h2>
          {sch ? <>
            <p>{sch.type === 'flat' ? `${sch.flat}% flat.` : `${bandTxt(sch.bands)}, counted per ${winName[sch.window] || sch.window}, ${sch.retro === 'yes' ? 'and the higher rate applies to every enrolment in the period' : sch.retro === 'top' ? 'and the top rate applies to every enrolment once it’s reached' : 'and the higher rate applies to later enrolments'}.`}</p>
            {tier && <p className="gspx-sentence">{tier.wk}: <b className="num">{tier.n}</b> enrolled students count{tier.n ? <>, band <b>{tier.pct}%</b></> : ''}. {tier.next ? <>{tier.need} more to reach {tier.next[2]}%.</> : 'You’re in the top band.'}</p>}
          </> : <p>{rp.flat}% flat.</p>}
          {rp.from && <p className="muted">These terms are in force for intakes from {nice(rp.from)}.</p>}
          <p className="muted">Notices and promotions may pay more for some enrolments; those show on each line.</p>
          <Notices c={c} rp={rp} />
        </Card>
        <Card>
          <h2 className="gspx-h3">Where we pay</h2>
          <p>{rp.bank === 'AU' ? 'Australian bank account' : 'Local bank account'} in {cur}.{rp.bankLast4 ? <> Account ending <span className="num">••{rp.bankLast4}</span>.</> : ' The account on file with GSP.'}</p>
          {rp.bankVerified === false ? <Notice tone="warn">New bank details are waiting for GSP to verify them. Payouts are held until then.</Notice> : <p className="muted">Verified by GSP.</p>}
          {canBank && <div><Button onClick={() => setBank(true)}>Change bank details</Button></div>}
        </Card>
      </div>
      <Card flush>
        <div className="stools"><div className="stools__row"><Segmented label="Show" options={SHOW} value={f} onChange={setF} /></div>
          <p className="stools__count"><span><span className="num">{list.length}</span> lines{queries.length ? ` · ${queries.length} queries open` : ''}</span></p></div>
        <Table head={['Student', 'University', 'Line', 'Your rate', `Amount (${cur})`, 'Status', '']}
          empty={!list.length && <Empty title="Nothing here yet">Commission appears once a student enrols.</Empty>}>
          {list.map(({ x, state, amt, due }) => {
            const q = queries.find(y => y.app === x.app && y.key === x.key);
            return (
              <tr key={x.app + x.key} className="irow">
                <td>{x.a.student}<span className="irow__sub">{x.app}</span></td>
                <td>{x.r.u.name}<span className="irow__sub">Course start {nice(x.a.intake)}</span></td>
                <td>{x.label.replace('Commission, instalment', 'Instalment')}{x.r.notice?.pct && x.kind === 'pct' && !x.a.gspLead ? <span className="irow__sub">{x.r.notice.pct.name}</span> : x.a.gspLead ? <span className="irow__sub">GSP lead</span> : null}</td>
                <td className="num">{state === 'recover' && x.a.withdrawn ? '—' : <>{x.kind === 'pct' ? `${x.lp}%` : 'Bonus'}{x.kind === 'pct' && <span className="irow__sub">{rateWhy(x)}</span>}</>}</td>
                <td className="num">{state === 'recover' ? money(due, cur) : money(amt, cur)}</td>
                <td><Pill tone={LINE_STATUS[state][1]}>{LINE_STATUS[state][0]}</Pill>{q && <span className="irow__sub">Query open</span>}</td>
                <td><div className="gspx-acts"><LinkButton onClick={() => setWhy(x)}>How it’s worked out</LinkButton>{canAct && !q && <LinkButton onClick={() => setAsk(x)}>Query this line</LinkButton>}</div></td>
              </tr>);
          })}
        </Table>
      </Card>
      {bank && <BankSheet rp={rp} user={user} onClose={() => setBank(false)} />}
      {upload && inv && <UploadSheet inv={inv} rp={rp} user={user} onClose={() => setUpload(false)} />}
      {why && <RpWhy x={why} cur={cur} amt={inCur(why.ent, why.cur)} onClose={() => setWhy(null)} />}
      {ask && <QuerySheet x={ask} rp={rp} user={user} onClose={() => setAsk(null)} />}
    </Page>
  );
}

/** Notices GSP sent this RP (Q3): one notice, the same terms, sent to many RPs at once. */
function Notices({ c, rp }) {
  const mine = (c.cfg.notices || []).filter(n => n.sentAt && ((n.rps || []).includes(rp.id) || (!(n.rps || []).length && (n.regions || [n.region]).includes(rp.region))));
  if (!mine.length) return null;
  return <><h3 className="gspx-h4">Notices from GSP</h3><ul className="gspx-list">{mine.map(n => <li key={n.id}><b>{n.name}</b> · enrolments {nice(n.start)}{n.end ? ` to ${nice(n.end)}` : ' on'}</li>)}</ul></>;
}

/** How a line is worked out, for the RP (Q20): the fee, your effective % of it and your band; never GSP's side. */
function RpWhy({ x, cur, amt, onClose }) {
  const eff = effectivePct(x);
  const base = x.ip && x.ip.base ? x.ip.base : null;
  const t = x.r && x.r.rpTier;
  return (
    <Sheet title={`${x.a.student} · ${x.label.replace('Commission, instalment', 'Instalment')}`} sub={x.r.u.name} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
      <dl className="gspx-dl">
        {base != null && <><dt>Fee this is worked out on</dt><dd className="num">{money(base, x.cur)}</dd></>}
        {eff != null && <><dt>Your share of that fee</dt><dd className="num">{eff}%</dd></>}
        <dt>Your rate</dt><dd>{x.kind === 'pct' ? `${x.lp}%` : 'Bonus'} · {rateWhy(x)}</dd>
        {t && <><dt>Your tier band</dt><dd>{t.est ? 'Estimate: ' : ''}enrolment {t.rank}{t.total ? ` of ${t.total}` : ''} in {t.wk}</dd></>}
        <dt>Amount</dt><dd className="num"><b>{money(amt, cur)}</b>{x.cur !== cur ? <span className="irow__sub">From {money(x.ent, x.cur)} at the month’s rate</span> : null}</dd>
      </dl>
    </Sheet>
  );
}

/** Upload the signed invoice (Q13): the RP's own number and date, and the signed file. */
function UploadSheet({ inv, rp, user, onClose }) {
  const [d, setD] = useState({ no: inv.rpNo || '', date: '', file: '' });
  const errors = { no: !d.no.trim() ? 'Enter your invoice number.' : null, date: !d.date ? 'Enter the invoice date.' : null, file: !d.file ? 'Upload the signed invoice.' : null };
  const v = useCheck(errors);
  const send = () => {
    if (!v.submit()) return;
    update(x => { const i = x.comm.rpInv[inv.id]; Object.assign(i, { status: 'review', rpNo: d.no.trim(), rpDate: d.date, file: d.file, uploadedAt: Date.now(), reason: null, note: null }); i.history.push({ at: Date.now(), by: user.name, what: `Uploaded invoice ${d.no.trim()}` }); }, `${user.name} (${rp.name}) uploaded invoice ${d.no.trim()} for ${inv.cycleLabel}`);
    toast('Invoice uploaded', { text: 'GSP Finance checks it. You’ll hear when it’s approved or if anything needs fixing.' }); onClose();
  };
  return (
    <Sheet title="Upload signed invoice" sub={`${inv.cycleLabel} · system reference ${inv.ref}`} onClose={onClose} dirty={!!(d.no || d.date || d.file)} what="the invoice"
      footer={<><Button onClick={onClose}>Cancel</Button><Button kind="primary" onClick={send}>Upload</Button></>}>
      <Field id="iu-no" label="Your invoice number" required error={v.err('no')}><Input id="iu-no" value={d.no} onBlur={v.blur('no')} onChange={x => setD({ ...d, no: x })} /></Field>
      <Field id="iu-date" label="Invoice date" required error={v.err('date')}><DateField id="iu-date" value={d.date} onBlur={v.blur('date')} onChange={x => setD({ ...d, date: x })} /></Field>
      <Field id="iu-file" label="Signed invoice" required error={v.err('file')} hint="The system invoice with your number, date and signature. PDF.">
        <FileDrop id="iu-file" accept=".pdf,image/*" file={d.file || undefined} invalid={!!v.err('file')} label="Drag the invoice here, or" onFiles={f => setD({ ...d, file: f[0]?.name || '' })} onRemove={() => setD({ ...d, file: '' })} />
      </Field>
    </Sheet>
  );
}

/** Query a line (Q23): a thread with Finance on that line. */
function QuerySheet({ x, rp, user, onClose }) {
  const [t, setT] = useState('');
  const send = () => {
    if (!t.trim()) { toast('Write your question.'); return; }
    update(d => { d.comm.queries = [...(d.comm.queries || []), { id: 'Q-' + Date.now().toString(36), rp: rp.id, rpName: rp.name, app: x.app, key: x.key, student: x.a.student, line: x.label, text: t.trim(), at: Date.now(), by: user.name, status: 'open', thread: [] }]; }, `${user.name} (${rp.name}) queried ${x.label} for ${x.a.student}`);
    toast('Query sent', { text: 'GSP Finance answers here, on the line.' }); onClose();
  };
  return (
    <Sheet title="Query this line" sub={`${x.a.student} · ${x.label}`} onClose={onClose} dirty={!!t} what="the query" footer={<><Button onClick={onClose}>Cancel</Button><Button kind="primary" onClick={send}>Send</Button></>}>
      <Field id="q-t" label="Your question" required><Input id="q-t" value={t} onChange={setT} /></Field>
    </Sheet>
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
      { const t = x.comm.cfg.rps.find(r => r.id === rp.id); if (t.bankVerified !== false) t.prevLast4 = t.bankLast4; t.bankVerified = false; t.bankLast4 = no.slice(-4); t.bankName = d.name.trim(); }
      { const t = x.comm.cfg.rps.find(r => r.id === rp.id); t.bankChange = { state: 'open', at: Date.now(), by: user.id, letter: d.letter }; }
    }, `${user.name} changed ${rp.name}’s bank details (waiting for RP Ops to verify)`);
    toast('Bank details sent', { text: 'GSP RP Ops verifies the new account. Payouts are held until then.' }); onClose();
  };
  const set = (k, x) => setD({ ...d, [k]: x });
  return (
    <>
      <Sheet title="Change bank details" sub="GSP verifies new details before the next payout" onClose={onClose} dirty={dirty} what="the bank details"
        footer={<>{empty && <span className="muted gspx-grow" id="b-why">Fill in every field and add the bank letter to send.</span>}<Button onClick={onClose}>Cancel</Button><Button kind="primary" disabled={empty} aria-describedby={empty ? 'b-why' : undefined} onClick={() => v.submit() && setSure(true)}>Send to GSP</Button></>}>
        <Field id="b-n" label="Account name" required error={v.err('name')}><Input id="b-n" value={d.name} onBlur={v.blur('name')} onChange={x => set('name', x)} /></Field>
        <Field id="b-no" label="Account number" required error={v.err('no')}><Input id="b-no" inputMode={kind === 'SWIFT' ? 'text' : 'numeric'} autoComplete="off" value={d.no} onBlur={v.blur('no')} onChange={x => set('no', x)} /></Field>
        <Field id="b-no2" label="Account number again" required error={v.err('no2')} hint="Type it again, so a slip doesn’t send your commission to the wrong account."><Input id="b-no2" inputMode={kind === 'SWIFT' ? 'text' : 'numeric'} autoComplete="off" onPaste={e => e.preventDefault()} value={d.no2} onBlur={v.blur('no2')} onChange={x => set('no2', x)} /></Field>
        <Field id="b-c" label={code.label} required error={v.err('code')} hint={code.hint}><Input id="b-c" autoComplete="off" value={d.code} onBlur={v.blur('code')} onChange={x => set('code', kind === 'AU' ? x : x.toUpperCase())} /></Field>
        <Field id="b-letter" label="Bank letter or cancelled cheque" required error={v.err('letter')} hint="GSP checks the account against it. PDF or a photo.">
          <FileDrop id="b-letter" accept=".pdf,image/*" file={d.letter || undefined} invalid={!!v.err('letter')} describedBy={v.err('letter') ? 'b-letter-error' : 'b-letter-hint'}
            label="Drag the letter here, or" onFiles={f => set('letter', f[0]?.name || '')} onRemove={() => set('letter', '')} />
        </Field>
      </Sheet>
      <ConfirmDialog open={sure} title="Hold payouts until GSP verifies?" confirm="Send and hold payouts" onCancel={() => setSure(false)} onConfirm={() => { setSure(false); send(); }}>
        <p>Your payouts stop until GSP verifies the new account. Anything due before then waits for the next payout after it.</p>
      </ConfirmDialog>
    </>
  );
}
