// @ts-nocheck -- typed with the finance API.
/*
 * Commission lines (Jovial, 6 Nov: one page, made simple). Every application that earns commission has two
 * commission lines: University (what the university owes GSP) and Agency (what GSP owes the RP). Each line holds its
 * transactions: commission, commission after year 1, additional commission, bonuses, top-ups, recoveries, each with
 * its own trigger date and status. Anything that needs action (an exception) shows on its line, not in a tab of its
 * own. Finance's work happens here: raise university invoices, record payments (confirmed first), check and pay the
 * RPs' monthly invoices, answer RP queries, and override a transaction (Finance or Admin, with a reason).
 * Every amount, status and explanation comes from the commission engine (finance/engine.ts) and the stored records.
 */
import React, { useMemo, useState } from 'react';
import { update } from './store';
import { can, inScope } from './access';
import { Page, Card, Segmented, Table, Pill, Button, LinkButton, Sheet, Empty, Notice, Field, Input, NumberInput, DateField, toast } from './kit';
import { PersonaBar, usePersona } from './persona';
import { nice, money, r2 } from './engine';
import { useComm, liveRun, TONE, opsOf, cycleOf, downloadCsv } from './shared';
import { UniWhy, WhySheet, lineLabel } from './Commissions';
import { batchesOf, raiseBatch, PaySheet as UniPaySheet, FixSheet } from './UniInvoices';
import { CheckSheet, PaySheet as RpPaySheet, AnswerSheet } from './Payout';
import { INV_STATUS, onInvoice } from './rpInvoice';
import { MultiPick } from '../institution/records/MultiPick';

/* ---------- each transaction, in one shape for both sides ---------- */

/** A university transaction's type, from its line. */
const uniType = (l) => (l.bonus ? 'Bonus from the university' : l.topup ? 'Top-up' : l.type === 'additional' ? 'Additional commission' : l.annuity ? 'Commission after year 1' : 'Commission');
/** An agency transaction's type, from its line. */
const rpType = (x) => (x.kind === 'pct' ? (x.annuity ? 'Commission after year 1' : x.additional ? 'Additional commission' : 'Commission') : 'Bonus to the RP');

/** The simple status set (6 Nov), from the engine's own status. */
function uniStatus(l) {
  const s = l.st[0];
  if (/^(Ready|Top-up) to invoice/.test(s)) return ['Ready to invoice', 'dpill--checking'];
  if (s === 'Payment overdue') return ['Overdue', 'dpill--bad'];
  if (s === 'Invoiced') return ['Invoiced', ''];
  if (s === 'Paid') return ['Paid', 'dpill--verified'];
  if (/^Held/.test(s)) return ['Held', 'dpill--bad'];
  if (/recovers|Credit/.test(s)) return ['Recovering', 'dpill--bad'];
  if (s === 'Not payable') return ['Not payable', ''];
  return ['Not yet due', ''];
}
function rpStatus(x, inv) {
  const s = x.st[0];
  if (/^Held/.test(s)) return ['Held', 'dpill--bad'];
  if (x.due < 0) return ['Recovering', 'dpill--bad'];
  if (inv && x.due > 0) return [inv.status === 'approved' ? 'On RP invoice, approved' : inv.status === 'review' ? 'On RP invoice, to check' : 'On RP invoice', 'dpill--checking'];
  if (x.payable && x.due > 0) return ['Ready to pay', 'dpill--checking'];
  if (s === 'Paid') return ['Paid', 'dpill--verified'];
  if (/^Waiting/.test(s)) return ['Waiting for university', ''];
  if (s === 'Cannot price') return ['Can’t price', 'dpill--bad'];
  return [s, TONE[x.st[1]] || ''];
}
const UNI_STATUSES = ['Not yet due', 'Ready to invoice', 'Invoiced', 'Overdue', 'Paid', 'Held', 'Recovering', 'Not payable'];
const RP_STATUSES = ['Waiting for university', 'Ready to pay', 'On RP invoice', 'Paid', 'Held', 'Recovering'];

export default function CommissionLines({ start = 'uni' }) {
  const { s, c, cfg, res } = useComm();
  const { user, role } = usePersona();
  const [side, setSide] = useState(start === 'rp' ? 'rp' : 'uni');
  const [unis, setUnis] = useState([]);
  const [rps, setRps] = useState([]);
  const [regions, setRegions] = useState([]);
  const [status, setStatus] = useState([]);
  const [types, setTypes] = useState([]);
  const [q, setQ] = useState('');
  const [needs, setNeeds] = useState(start === 'exc');
  const [open, setOpen] = useState({});
  const [whyU, setWhyU] = useState(null);
  const [whyR, setWhyR] = useState(null);
  const [ov, setOv] = useState(null);
  const [payU, setPayU] = useState(null);
  const [fix, setFix] = useState(null);
  const [raising, setRaising] = useState(false);
  const [check, setCheck] = useState(null);
  const [payR, setPayR] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [selfPay, setSelfPay] = useState(null);
  // overrides: Finance and Admin (Jovial, 6 Nov), read from Admin's matrix
  // the university side is Institution Partners › Commission, the agency side Recruitment Partners › Commission (Admin's matrix)
  const canAct = can(s.matrix, role.id, side === 'uni' ? 'invoices' : 'payouts', 'U');
  const ops = opsOf(cfg);
  const cyc = cycleOf(cfg, c.today);
  const run = liveRun(c, res);
  const onInv = onInvoice(c);

  /* scope: regional roles see their regions' RPs only */
  const scoped = (rp) => inScope(user, { region: rp?.region || undefined }, s.roles);
  const excBy = useMemo(() => { const m = new Map(); res.exc.forEach((e) => { if (e.app) m.set(e.app, [...(m.get(e.app) || []), e]); }); return m; }, [res]);
  const queries = (c.queries || []).filter((x) => x.status === 'open');

  /* the transactions, then the commission lines they belong to */
  const uniTx = res.ip.filter((x) => scoped(res.apps[x.app]?.rp)).map((x) => ({ side: 'uni', x, key: x.app + '|' + x.l.key, app: x.app, a: x.a, student: x.a.student, party: x.u.name, partyId: x.u.id, region: res.apps[x.app]?.rp?.region || '', type: uniType(x.l), label: lineLabel(x.l), date: x.l.date, amt: x.l.ent, cur: x.u.cur, st: uniStatus(x.l), note: x.l.st[2] || '', ov: x.l.ov }));
  const rpTx = res.rp.filter((x) => scoped(x.r.rp)).map((x) => { const p = x.r.payee || x.r.rp; const inv = onInv.get(x.app + '|' + x.key); return { side: 'rp', x, inv, key: x.app + '|' + x.key, app: x.app, a: x.a, student: x.a.student, party: p.name, partyId: p.id, region: p.region || '', type: rpType(x), label: x.label, date: x.ip?.date || null, amt: x.ent, cur: x.cur, st: rpStatus(x, inv), note: x.due < 0 ? `Recover ${money(-x.due, x.cur)} from the next invoice` : x.paid ? `Paid ${money(x.paid, x.cur)}` : '', ov: x.ov, query: queries.find((y) => y.app === x.app && y.key === x.key) }; });
  const tx = side === 'uni' ? uniTx : rpTx;

  const lc = q.trim().toLowerCase();
  const keep = (t) =>
    (side === 'uni' ? !unis.length || unis.includes(t.partyId) : (!rps.length || rps.includes(t.partyId)) && (!regions.length || regions.includes(t.region))) &&
    (!status.length || status.some((x) => t.st[0].startsWith(x))) &&
    (!types.length || types.includes(t.type)) &&
    (!lc || `${t.student} ${t.app}`.toLowerCase().includes(lc)) &&
    (!needs || excBy.has(t.app) || /^(Held|Overdue|Recovering|Can)/.test(t.st[0]) || t.query);
  const shown = tx.filter(keep);
  const lines = useMemo(() => {
    const m = new Map();
    for (const t of shown) {
      const k = t.app + '|' + t.partyId;
      const L = m.get(k) || { key: k, app: t.app, student: t.student, party: t.party, region: t.region, a: t.a, cur: t.cur, tx: [] };
      L.tx.push(t); m.set(k, L);
    }
    return [...m.values()].sort((x, y) => x.student.localeCompare(y.student));
  }, [shown]);

  /* option lists come from the data on the page, never typed in */
  const partyOpts = [...new Map(tx.map((t) => [t.partyId, t.party])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const regionOpts = [...new Set(rpTx.map((t) => t.region).filter(Boolean))].sort();
  const typeOpts = [...new Set(tx.map((t) => t.type))].sort();
  const statusOpts = side === 'uni' ? UNI_STATUSES : RP_STATUSES;

  /* the actions that need doing now */
  const batches = batchesOf(res.ip.filter((x) => scoped(res.apps[x.app]?.rp)), cfg, c.uniInv);
  const invOf = (t) => Object.values(c.uniInv || {}).find((i) => i.status === 'sent' && i.lines.some((L) => L.app === t.app && L.key === t.x.l.key));
  const diffs = (c.diffs || []).filter((d) => d.status === 'open');
  const rpInvs = Object.values(c.rpInv || {}).filter((i) => i.status === 'review' || i.status === 'approved');

  const exportCsv = () => downloadCsv(`commission-lines-${side === 'uni' ? 'university' : 'agency'}-${c.today}.csv`,
    ['Student', 'Application', side === 'uni' ? 'University' : 'RP', ...(side === 'rp' ? ['Sales region'] : []), 'Transaction', 'Type', 'Trigger date', 'Amount', 'Currency', 'Status', 'Needs action', 'Overridden'],
    shown.map((t) => [t.student, t.app, t.party, ...(side === 'rp' ? [t.region] : []), t.label, t.type, t.date || '', t.amt, t.cur, t.st[0], (excBy.get(t.app) || []).map((e) => e.type).join('; '), t.ov ? `${t.ov.byName || ''}: ${t.ov.reason || ''}` : '']));

  const total = (list) => { const by = {}; list.forEach((t) => { by[t.cur] = r2((by[t.cur] || 0) + (t.amt || 0)); }); return Object.entries(by).map(([k, v]) => money(v, k)).join(' + ') || '—'; };
  const worst = (list) => { const order = side === 'uni' ? ['Overdue', 'Held', 'Recovering', 'Ready to invoice', 'Invoiced', 'Not yet due', 'Paid', 'Not payable'] : ['Held', 'Recovering', 'Can’t price', 'Ready to pay', 'On RP invoice', 'Waiting for university', 'Paid']; return list.map((t) => t.st).sort((a, b) => order.findIndex((o) => a[0].startsWith(o)) - order.findIndex((o) => b[0].startsWith(o)))[0]; };

  return (
    <Page title="Commission lines" top={<PersonaBar />}
      lead="Every application that earns commission has two lines: what the university owes GSP, and what GSP owes the RP. Open a line to see each transaction and its status."
      actions={<Button onClick={exportCsv}>Export</Button>}>
      <Segmented label="Side" options={[['uni', `University (${uniTx.length})`], ['rp', `Agency (${rpTx.length})`]]} value={side} onChange={(v) => { setSide(v); setStatus([]); setTypes([]); }} />

      {/* what needs doing now, on this side */}
      {side === 'uni' && canAct && (batches.length > 0 || diffs.length > 0) && (
        <Notice tone="warn">
          <span className="gspx-row">
            <span className="gspx-grow">{batches.length ? <>{batches.reduce((n, b) => n + b.lines.length, 0)} transactions are ready to invoice, for {batches.length} invoice{batches.length === 1 ? '' : 's'} this month. </> : null}{diffs.length ? <>{diffs.length} payment difference{diffs.length === 1 ? '' : 's'} to resolve.</> : null}</span>
            {batches.length > 0 && <Button size="sm" kind="primary" onClick={() => setRaising(true)}>Raise invoices</Button>}
            {diffs.length > 0 && <LinkButton onClick={() => setFix(diffs[0])}>Resolve a difference</LinkButton>}
          </span>
        </Notice>)}
      {side === 'rp' && (rpInvs.length > 0 || run.hold.length > 0 || run.bankHold.length > 0) && (
        <Card flush>
          <div className="gspx-pad"><h2 className="gspx-h3">RP invoices · {cyc.label}</h2><p className="muted">RPs upload their signed monthly invoice on Earnings. Check it, then pay by {nice(cyc.payBy)}.</p></div>
          {run.hold.length > 0 && <div className="gspx-pad"><Notice tone="warn">Held: no exchange rate this week for {run.hold.join(', ')}. Enter it in Exchange rates.</Notice></div>}
          {run.bankHold.length > 0 && <div className="gspx-pad"><Notice tone="warn">Held until RP Ops verifies new bank details: {run.bankHold.join(', ')}.</Notice></div>}
          {rpInvs.length > 0 && <Table head={['RP', 'Lines', 'Amount', 'Status', '']}>
            {rpInvs.map((i) => (
              <tr key={i.id} className="irow">
                <td>{i.rpName}<span className="irow__sub">{i.cycleLabel} · RP’s number {i.rpNo || '—'}</span></td>
                <td className="num">{i.lines.length}</td>
                <td className="num">{Object.entries(i.total).map(([k, v]) => money(v, k)).join(' + ')}</td>
                <td><Pill tone={INV_STATUS[i.status][1]}>{INV_STATUS[i.status][0]}</Pill></td>
                <td>{canAct && (i.status === 'review' ? <Button size="sm" kind="primary" onClick={() => setCheck(i)}>Check</Button> : <Button size="sm" kind="primary" onClick={() => setPayR(i)}>Mark paid</Button>)}</td>
              </tr>))}
          </Table>}
        </Card>)}

      <Card flush>
        <div className="stools">
          <div className="stools__row gspx-filters">
            {side === 'uni'
              ? <MultiPick id="cl-uni" label="University" value={unis} options={partyOpts.map(([id]) => id)} labelOf={(id) => partyOpts.find((p) => p[0] === id)?.[1] ?? id} empty="All universities" search onChange={setUnis} />
              : <>
                <MultiPick id="cl-rp" label="RP" value={rps} options={partyOpts.map(([id]) => id)} labelOf={(id) => partyOpts.find((p) => p[0] === id)?.[1] ?? id} empty="All RPs" search pageSize={30} onChange={setRps} />
                <MultiPick id="cl-reg" label="Sales region" value={regions} options={regionOpts} empty="All regions" onChange={setRegions} />
              </>}
            <MultiPick id="cl-st" label="Status" value={status} options={statusOpts} empty="Any status" onChange={setStatus} />
            <MultiPick id="cl-ty" label="Type" value={types} options={typeOpts} empty="Any type" onChange={setTypes} />
            <Input id="cl-q" value={q} onChange={setQ} placeholder="Search student or application" aria-label="Search student or application" />
            <label className="gspx-check"><input type="checkbox" checked={needs} onChange={(e) => setNeeds(e.target.checked)} /> Needs action only</label>
          </div>
          <p className="stools__count"><span><span className="num">{lines.length}</span> lines · <span className="num">{shown.length}</span> transactions · {total(shown)}</span></p>
        </div>
        <Table head={['Student', side === 'uni' ? 'University' : 'RP', 'Transactions', 'Amount', 'Status', '']}
          empty={!lines.length && <Empty title="No commission lines here">Lines appear once a student enrols. Try fewer filters.</Empty>}>
          {lines.map((L) => {
            const isOpen = !!open[L.key];
            const exc = excBy.get(L.app) || [];
            const st = worst(L.tx);
            return (
              <React.Fragment key={L.key}>
                <tr className="irow">
                  <td><button type="button" className="btn btn--link gspx-link" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [L.key]: !isOpen })}>{isOpen ? '▾' : '▸'} {L.student}</button><span className="irow__sub">{L.app}</span></td>
                  <td>{L.party}{side === 'rp' && L.region && <span className="irow__sub">{L.region}</span>}</td>
                  <td className="num">{L.tx.length}</td>
                  <td className="num">{total(L.tx)}</td>
                  <td><Pill tone={st[1]}>{st[0]}</Pill>{exc.map((e) => <span key={e.type} className="irow__sub gspx-bad">Needs action: {e.type}. {e.msg}</span>)}</td>
                  <td />
                </tr>
                {isOpen && L.tx.map((t) => (
                  <tr key={t.key} className="irow irow--child">
                    <td className="gspx-indent">{t.label}<span className="irow__sub">{t.type}</span></td>
                    <td className="num">{t.date ? nice(t.date) : '—'}<span className="irow__sub">{side === 'uni' ? 'Trigger date' : 'When the university pays'}</span></td>
                    <td />
                    <td className="num">{money(t.amt, t.cur)}</td>
                    <td><Pill tone={t.st[1]}>{t.st[0]}</Pill>{t.note && <span className="irow__sub">{t.note}</span>}{t.ov && <span className="irow__sub">Overridden by {t.ov.byName || 'Finance'}: {t.ov.reason}</span>}{t.query && <span className="irow__sub">Query from the RP: {t.query.text}</span>}</td>
                    <td><div className="gspx-acts">
                      <LinkButton onClick={() => (side === 'uni' ? setWhyU(t.x) : setWhyR(t.x))}>How it’s worked out</LinkButton>
                      {canAct && side === 'uni' && /Invoiced|Overdue/.test(t.st[0]) && (invOf(t) ? <LinkButton onClick={() => setPayU(invOf(t))}>Record payment</LinkButton> : <LinkButton onClick={() => setSelfPay(t)}>Record payment</LinkButton>)}
                      {canAct && side === 'uni' && t.st[0] === 'Ready to invoice' && t.x.u.selfBilling && <LinkButton onClick={() => setSelfPay(t)}>Record payment</LinkButton>}
                      {canAct && t.query && <LinkButton onClick={() => setAnswer(t.query)}>Answer query</LinkButton>}
                      {canAct && !/^Paid|Not payable/.test(t.st[0]) && <LinkButton onClick={() => setOv(t)}>Override</LinkButton>}
                    </div></td>
                  </tr>))}
              </React.Fragment>);
          })}
        </Table>
      </Card>

      {whyU && <UniWhy x={whyU} r={res.apps[whyU.app]} cfg={cfg} onClose={() => setWhyU(null)} />}
      {whyR && <WhySheet x={whyR} canEdit={false} user={user} onClose={() => setWhyR(null)} />}
      {ov && <OverrideSheet t={ov} user={user} onClose={() => setOv(null)} />}
      {raising && <RaiseSheet batches={batches} cyc={cyc} user={user} onClose={() => setRaising(false)} />}
      {payU && <UniPaySheet inv={payU} c={c} ops={ops} user={user} onClose={() => setPayU(null)} />}
      {selfPay && <SelfPaySheet t={selfPay} user={user} onClose={() => setSelfPay(null)} />}
      {fix && <FixSheet d={fix} user={user} onClose={() => setFix(null)} />}
      {check && <CheckSheet inv={check} ops={ops} user={user} onClose={() => setCheck(null)} />}
      {payR && <RpPaySheet inv={payR} c={c} user={user} onClose={() => setPayR(null)} />}
      {answer && <AnswerSheet q={answer} user={user} onClose={() => setAnswer(null)} />}
    </Page>
  );
}

/** Raise this month's university invoices: each batch, one click each, or all. */
function RaiseSheet({ batches, cyc, user, onClose }) {
  const [done, setDone] = useState({});
  const left = batches.filter((b) => !done[b.key]);
  const raise = (b) => { raiseBatch(b, cyc, user); setDone((d) => ({ ...d, [b.key]: true })); };
  return (
    <Sheet title={`Raise invoices · ${cyc.label}`} sub="Ready transactions, batched per university (or per student where its terms say so)" onClose={onClose} wide
      footer={<><Button onClick={onClose}>Close</Button>{left.length > 1 && <Button kind="primary" onClick={() => left.forEach(raise)}>Raise all {left.length}</Button>}</>}>
      <Table head={['University', 'From', 'Transactions', 'Amount', '']}>
        {batches.map((b) => (
          <tr key={b.key} className="irow">
            <td>{b.u.name}{b.student && <span className="irow__sub">{b.student}</span>}</td>
            <td>{b.entity?.name}</td>
            <td className="num">{b.lines.length}</td>
            <td className="num">{money(b.total, b.u.cur)}<span className="irow__sub">including tax</span></td>
            <td>{done[b.key] ? <Pill tone="dpill--verified">Raised</Pill> : <Button size="sm" kind="primary" onClick={() => raise(b)}>Raise</Button>}</td>
          </tr>))}
      </Table>
    </Sheet>
  );
}

/** A self-billing university's payment (or one invoiced before monthly batches): recorded on the transaction, confirmed first. */
function SelfPaySheet({ t, user, onClose }) {
  const [ref, setRef] = useState('');
  const [sure, setSure] = useState(false);
  const x = t.x;
  const go = () => {
    update((d) => { const a = d.comm.apps[x.app]; a.paidIP = { ...(a.paidIP || {}), [x.l.key]: { date: d.comm.today, amt: x.l.ent, ref: ref.trim() } }; }, `${user.name} recorded ${money(x.l.ent, x.u.cur)} from ${x.u.name} for ${x.a.student}, reference ${ref.trim()}`);
    toast('Payment recorded', { text: 'The RP’s share is now ready to pay.' }); onClose();
  };
  return (
    <Sheet title={`Payment from ${x.u.name}`} sub={`${x.a.student} · ${t.label}`} onClose={onClose}
      footer={sure ? <><Button onClick={() => setSure(false)}>Back</Button><Button kind="primary" onClick={go}>Confirm payment</Button></> : <><Button onClick={onClose}>Cancel</Button><Button kind="primary" onClick={() => (ref.trim() ? setSure(true) : toast('Enter the statement or bank reference.'))}>Record payment</Button></>}>
      {sure
        ? <Notice tone="warn">Record <b>{money(x.l.ent, x.u.cur)}</b> from {x.u.name} for {x.a.student}, reference {ref.trim()}? The transaction becomes Paid and the RP’s share becomes ready to pay.</Notice>
        : <Field id="sp-ref" label="Statement or bank reference" required><Input id="sp-ref" value={ref} onChange={setRef} /></Field>}
    </Sheet>
  );
}

/**
 * Override a transaction (Jovial, 6 Nov): Finance or Admin; the amount, the trigger date (university side) or a hold,
 * with a reason. Logged with the person, the time and the reason, and shown on the transaction; Remove override goes
 * back to the calculated value. A status itself is never typed in: it follows from these.
 */
function OverrideSheet({ t, user, onClose }) {
  const uni = t.side === 'uni';
  const keyOf = uni ? 'ip' + t.x.l.key : t.x.key;
  const was = t.ov || {};
  const [amt, setAmt] = useState(was.amt ?? '');
  const [date, setDate] = useState(was.date ?? '');
  const [hold, setHold] = useState(!!was.hold);
  const [reason, setReason] = useState('');
  const changed = String(amt) !== String(was.amt ?? '') || String(date) !== String(was.date ?? '') || hold !== !!was.hold;
  const save = (clear) => {
    if (!clear && !changed) { toast('Change the amount, the date or the hold first.'); return; }
    if (!reason.trim()) { toast('Give the reason for the override.'); return; }
    update((d) => {
      const a = d.comm.apps[t.app]; a.override = { ...(a.override || {}) };
      if (clear) delete a.override[keyOf];
      else a.override[keyOf] = { ...(amt !== '' ? { amt: Number(amt) } : {}), ...(uni && date ? { date } : {}), ...(hold ? { hold: true } : {}), reason: reason.trim(), by: user.id, byName: user.name, at: Date.now() };
    }, clear ? `${user.name} removed the override on ${t.student} (${t.label}): ${reason.trim()}` : `${user.name} overrode ${t.student} (${t.label})${amt !== '' ? `: amount ${money(Number(amt), t.cur)}` : ''}${uni && date ? `, trigger date ${nice(date)}` : ''}${hold ? ', held' : ''}. Reason: ${reason.trim()}`);
    toast(clear ? 'Override removed' : 'Override saved', { text: 'Logged with your name and the reason.' }); onClose();
  };
  return (
    <Sheet title={`Override · ${t.label}`} sub={`${t.student} · ${t.party} · now ${money(t.amt, t.cur)}, ${t.st[0]}`} onClose={onClose}
      footer={<>{t.ov && <LinkButton onClick={() => save(true)}>Remove override</LinkButton>}<Button onClick={onClose}>Cancel</Button><Button kind="primary" onClick={() => save(false)}>Save override</Button></>}>
      <Field id="ov-a" label={`Amount (${t.cur})`} hint="Empty keeps the calculated amount."><NumberInput id="ov-a" value={amt} onChange={setAmt} /></Field>
      {uni && <Field id="ov-d" label="Trigger date" hint="Empty keeps the date from the terms."><DateField id="ov-d" value={date} onChange={setDate} /></Field>}
      <label className="gspx-check"><input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} /> Hold this transaction</label>
      <Field id="ov-r" label="Reason" required hint="Shown on the transaction and in the log."><Input id="ov-r" value={reason} onChange={setReason} /></Field>
    </Sheet>
  );
}
