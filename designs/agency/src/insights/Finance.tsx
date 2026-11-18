import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { Checkbox, Field, TextInput } from '../components/forms';
import { PageHead } from '../institution/records/parts';
import { ACTION_FROM, groupOf, type CommState } from '../finance/commission/model';
import type { Result, Tx } from '../finance/commission/engine';
import { ctxUnis, ipName, saveFollowUp } from '../finance/commission/store';
import type { FxWeek } from '../admin/data/config';
import { pct, rate, type InsightSettings } from './metrics';
import { Card, CsvButton, Seg, Table, Tabs, type Col } from './parts';

type Tab = 'ar' | 'ap' | 'wo' | 'bonus' | 'margin';
const TABS: [Tab, string][] = [
  ['ar', 'Receivables ageing'],
  ['ap', 'RP payables'],
  ['wo', 'Write-offs'],
  ['bonus', 'Bonus tracking'],
  ['margin', 'IP & RP analysis'],
];

/**
 * Finance dashboards (round 4, 18 Nov): read the commission lines themselves (the engine's result and Finance's
 * records), as the product will. Amounts in AUD at this week's rates (Admin › Currency exchange).
 */
export function Finance({ res, comm, fx, s, now, me, say }: { res: Result; comm: CommState; fx: FxWeek[]; s: InsightSettings; now: number; me: string; say: (t: string) => void }) {
  const [tab, setTab] = useState<Tab>('ar');
  const aud = useMemo(() => {
    const rows = fx[0]?.rows ?? [];
    return (amount: number, cur: string) => amount * (cur === 'AUD' ? 1 : rows.find((r) => r.code === cur)?.aud ?? 0);
  }, [fx]);
  return (
    <div className="ins">
      <PageHead title="Finance" lead={`From the commission lines, in AUD at the week of ${fx[0]?.week ?? '—'}'s rates. Each table downloads as a CSV.`} />
      <Tabs label="Finance dashboards" value={tab} items={TABS} onPick={setTab} />
      {tab === 'ar' && <Receivables res={res} comm={comm} aud={aud} s={s} now={now} me={me} say={say} />}
      {tab === 'ap' && <Payables res={res} aud={aud} now={now} />}
      {tab === 'wo' && <WriteOffs res={res} comm={comm} aud={aud} />}
      {tab === 'bonus' && <Bonus res={res} />}
      {tab === 'margin' && <Margins res={res} aud={aud} s={s} now={now} />}
    </div>
  );
}
type Aud = (amount: number, cur: string) => number;
const money = (x: number) => `AUD ${Math.round(x).toLocaleString('en-GB')}`;
const ipOf = (uni: string) => ipName(ctxUnis().find((u) => u.id === uni)?.ip) || ctxUnis().find((u) => u.id === uni)?.name || uni;

/* Receivables ageing (Cady): unpaid university invoices by days past due, with the team's follow-ups */
function Receivables({ res, comm, aud, s, now, me, say }: { res: Result; comm: CommState; aud: Aud; s: InsightSettings; now: number; me: string; say: (t: string) => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  const open = res.txs.filter((t) => t.side === 'uni' && (ACTION_FROM.record as readonly string[]).includes(t.status) && t.invoice);
  const out = (t: Tx) => aud(t.amount + (t.gst ?? 0) - (t.received ?? 0), t.currency);
  const late = (t: Tx) => Math.floor((now - new Date(`${t.due}T12:00:00`).getTime()) / 86_400_000);
  const b = s.arBuckets;
  const label = (i: number) => (i === 0 ? `<${b[0]}` : i === b.length ? `>${b[b.length - 1]}` : `${b[i - 1]}–${b[i]}`);
  const bucket = (t: Tx) => {
    const x = late(t);
    const i = b.findIndex((lim) => x < lim);
    return i < 0 ? b.length : i;
  };
  const fol = (inv: string) => [...(comm.followUps ?? [])].reverse().find((f) => f.invoice === inv);
  const byInv = new Map<string, Tx[]>();
  open.forEach((t) => byInv.set(t.invoice!, [...(byInv.get(t.invoice!) ?? []), t]));
  const rows = [...byInv.entries()].map(([inv, l]) => {
    const cells = Array.from({ length: b.length + 1 }, () => 0);
    l.forEach((t) => (cells[bucket(t)] += out(t)));
    return { inv, l, uni: l[0].uniName, intake: l[0].intake, cells, total: cells.reduce((a, x) => a + x, 0), oldest: Math.max(...l.map(late)), f: fol(inv) };
  }).sort((a, b2) => b2.oldest - a.oldest);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: 'Institution', v: (r) => r.uni },
    { h: 'Intake', v: (r) => r.intake },
    { h: 'Invoice', v: (r) => r.inv },
    ...b.concat([Infinity]).map((_, i): Col<R> => ({ h: label(i), n: true, v: (r) => (r.cells[i] ? Math.round(r.cells[i]).toLocaleString('en-GB') : ''), csv: (r) => Math.round(r.cells[i]) })),
    { h: 'Total (AUD)', n: true, v: (r) => Math.round(r.total).toLocaleString('en-GB'), csv: (r) => Math.round(r.total) },
    { h: 'Expected payment', v: (r) => r.f?.expected ?? '', csv: (r) => r.f?.expected ?? '' },
    { h: 'Comment', v: (r) => r.f?.comment ?? '', csv: (r) => r.f?.comment ?? '' },
    { h: 'Escalate', v: (r) => (r.f?.escalate ? 'Yes' : ''), csv: (r) => (r.f?.escalate ? 'Yes' : '') },
    { h: '', v: (r) => <Button variant="secondary" size="sm" onClick={() => setEdit(r.inv)}>Follow up</Button>, csv: () => '' },
  ];
  const tot = Array.from({ length: b.length + 1 }, (_, i) => rows.reduce((a, r) => a + r.cells[i], 0));
  const esc = rows.filter((r) => r.f?.escalate);
  const cur = rows.find((r) => r.inv === edit);
  return (
    <>
      <div className="ins-stats">
        <div className="ins-stat"><span className="ins-stat__k">Outstanding</span><span className="ins-stat__n">{money(tot.reduce((a, x) => a + x, 0))}</span><span className="ins-stat__sub">{rows.length} invoices</span></div>
        {tot.map((x, i) => (
          <div key={i} className="ins-stat"><span className="ins-stat__k">{label(i)} days</span><span className="ins-stat__n">{money(x)}</span></div>
        ))}
        <div className="ins-stat"><span className="ins-stat__k">Escalated</span><span className="ins-stat__n">{esc.length}</span><span className="ins-stat__sub">{money(esc.reduce((a, r) => a + r.total, 0))}</span></div>
      </div>
      <Card title="Commission aged receivables" sub="Unpaid invoices (Invoiced, Overdue, Part paid) by days past the due date · Follow up records the expected payment date, a comment and whether to escalate" flush action={<CsvButton name="aged-receivables" rows={rows} cols={cols} />}>
        <Table rows={rows} cols={cols} rowKey={(r) => r.inv} empty="No unpaid invoices." />
      </Card>
      <FollowSheet
        open={!!cur}
        inv={cur?.inv ?? ''}
        was={cur?.f}
        onClose={() => setEdit(null)}
        onSave={(f) => {
          saveFollowUp({ invoice: cur!.inv, ...f }, cur!.l.map((t) => t.id), me);
          say(`Follow-up saved on ${cur!.inv}.`);
          setEdit(null);
        }}
      />
    </>
  );
}
function FollowSheet({ open, inv, was, onClose, onSave }: { open: boolean; inv: string; was?: { expected: string; comment: string; escalate: boolean }; onClose: () => void; onSave: (f: { expected: string; comment: string; escalate: boolean }) => void }) {
  const [expected, setExpected] = useState('');
  const [comment, setComment] = useState('');
  const [escalate, setEscalate] = useState(false);
  useEffect(() => {
    setExpected(was?.expected ?? '');
    setComment(was?.comment ?? '');
    setEscalate(was?.escalate ?? false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={open} onClose={onClose} center className="iform" title={`Follow up ${inv}`} sub="What the university said" footer={<div className="asf"><div className="asf__acts"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => onSave({ expected, comment: comment.trim(), escalate })}>Save</Button></div></div>}>
      <div className="iform__grid">
        <Field id="fu-exp" label="Expected payment date">
          <TextInput id="fu-exp" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
        </Field>
        <Field id="fu-com" label="Comment" className="iform__wide">
          <TextInput id="fu-com" value={comment} maxLength={300} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <div className="iform__wide">
          <Checkbox id="fu-esc" checked={escalate} onChange={setEscalate} hint="It shows on the Escalations count and in the CSV.">
            Escalate
          </Checkbox>
        </div>
      </div>
    </Sheet>
  );
}

/* RP payables: approved RP lines by the week they're due, and overdue */
function Payables({ res, aud, now }: { res: Result; aud: Aud; now: number }) {
  const due = res.txs.filter((t) => t.side === 'rp' && (ACTION_FROM.pay as readonly string[]).includes(t.status));
  const week = (k: number) => {
    const x = new Date(now);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7) + 7 * k);
    return x.toISOString().slice(0, 10);
  };
  const weeks = [1, 2, 3, 4].map(week);
  const today = new Date(now).toISOString().slice(0, 10);
  const slot = (t: Tx) => (t.due < today ? -1 : weeks.findIndex((w) => t.due < w));
  const by = new Map<string, Tx[]>();
  due.forEach((t) => by.set(t.rpName, [...(by.get(t.rpName) ?? []), t]));
  const rows = [...by.entries()].map(([rp, l]) => {
    const sum = (k: number) => l.filter((t) => slot(t) === k).reduce((a, t) => a + aud(t.amount, t.currency), 0);
    return { rp, region: l[0].region, w: [0, 1, 2, 3].map(sum), over: sum(-1), total: l.reduce((a, t) => a + aud(t.amount, t.currency), 0) };
  }).sort((a, b) => b.total - a.total);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: 'RP', v: (r) => r.rp },
    { h: 'Sales region', v: (r) => r.region },
    ...weeks.map((w, i): Col<R> => ({ h: `Pay by ${new Date(`${w}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`, n: true, v: (r) => Math.round(r.w[i]).toLocaleString('en-GB'), csv: (r) => Math.round(r.w[i]) })),
    { h: 'Overdue', n: true, v: (r) => Math.round(r.over).toLocaleString('en-GB'), csv: (r) => Math.round(r.over) },
    { h: 'Total (AUD)', n: true, v: (r) => Math.round(r.total).toLocaleString('en-GB'), csv: (r) => Math.round(r.total) },
  ];
  return (
    <Card title="RP payables" sub="Approved RP lines (Approved, Overdue to pay), by the week they're due · as the country reports' Agent Payable Report" flush action={<CsvButton name="rp-payables" rows={rows} cols={cols} />}>
      <Table rows={rows} cols={cols} rowKey={(r) => r.rp} empty="Nothing approved to pay." />
    </Card>
  );
}

/* Write-offs (Suman): every write-off with its reason, sliced */
type WDim = 'rp' | 'ip' | 'uni' | 'intake' | 'course' | 'region' | 'reason';
function WriteOffs({ res, comm, aud }: { res: Result; comm: CommState; aud: Aud }) {
  const [dim, setDim] = useState<WDim>('uni');
  const items = comm.writeOffs.map((w) => ({ w, t: res.byId.get(w.tx) })).filter((x): x is { w: (typeof comm.writeOffs)[number]; t: Tx } => !!x.t);
  const key = (x: (typeof items)[number]) => ({ rp: x.t.rpName, ip: ipOf(x.t.uni), uni: x.t.uniName, intake: x.t.intake, course: x.t.course, region: x.t.region, reason: x.w.reason })[dim];
  const by = new Map<string, typeof items>();
  items.forEach((x) => by.set(key(x), [...(by.get(key(x)) ?? []), x]));
  const rows = [...by.entries()].map(([k, l]) => ({ k, l, total: l.reduce((a, x) => a + aud(x.w.amount, x.t.currency), 0) })).sort((a, b) => b.total - a.total);
  type R = (typeof rows)[number];
  const DIMS: [WDim, string][] = [['uni', 'University'], ['ip', 'IP'], ['rp', 'RP'], ['intake', 'Intake'], ['course', 'Course'], ['region', 'Sales region'], ['reason', 'Reason']];
  const cols: Col<R>[] = [
    { h: DIMS.find((x) => x[0] === dim)![1], v: (r) => r.k },
    { h: 'Write-offs', n: true, v: (r) => r.l.length },
    { h: 'Amount (AUD)', n: true, v: (r) => Math.round(r.total).toLocaleString('en-GB'), csv: (r) => Math.round(r.total) },
  ];
  const lcols: Col<(typeof items)[number]>[] = [
    { h: 'Line', v: (x) => x.t.id },
    { h: 'Student', v: (x) => x.t.student },
    { h: 'University', v: (x) => x.t.uniName },
    { h: 'RP', v: (x) => x.t.rpName },
    { h: 'Amount', n: true, v: (x) => `${x.t.currency} ${x.w.amount.toLocaleString('en-GB')}`, csv: (x) => x.w.amount },
    { h: 'Reason', v: (x) => x.w.reason },
    { h: 'By', v: (x) => x.w.by },
  ];
  return (
    <>
      <Card title="Write-offs processed" sub="Every write-off with its reason" flush action={<span className="ins-acts"><Seg label="By" value={dim} items={DIMS} onPick={setDim} /><CsvButton name="write-offs" rows={rows} cols={cols} /></span>}>
        <Table rows={rows} cols={cols} rowKey={(r) => r.k} empty="No write-offs yet." />
      </Card>
      <Card title="Each write-off" flush action={<CsvButton name="write-off-lines" rows={items} cols={lcols} />}>
        <Table rows={items} cols={lcols} rowKey={(x) => x.w.id} empty="No write-offs yet." />
      </Card>
    </>
  );
}

/* Bonus tracking (Suman): every tier and bonus scheme, its count so far and how many more reach the next band */
function Bonus({ res }: { res: Result }) {
  const [kind, setKind] = useState<'Bonus scheme' | 'Tier'>('Bonus scheme');
  const rows = res.unlocks.filter((u) => u.kind === kind).map((u) => {
    const next = u.bands.find((b) => b.more > 0);
    return { u, next };
  }).sort((a, b) => (a.next?.more ?? 1e9) - (b.next?.more ?? 1e9));
  const regions = [...new Set(res.unlocks.flatMap((u) => Object.keys(u.by.region)))].sort();
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: 'Name', v: (r) => r.u.name },
    { h: 'For', v: (r) => (r.u.who === 'group' ? `IP group (${r.u.unis.length} universities)` : 'University') },
    { h: 'Counting window', v: (r) => r.u.window },
    { h: 'Ends', v: (r) => r.u.ends },
    { h: 'Counted so far', n: true, v: (r) => r.u.count },
    { h: 'Next band', v: (r) => r.next?.label ?? 'Top band reached' },
    { h: 'More needed', n: true, v: (r) => (r.next ? r.next.more : '—'), csv: (r) => r.next?.more ?? '' },
    ...regions.map((g): Col<R> => ({ h: g, n: true, v: (r) => r.u.by.region[g] ?? 0 })),
  ];
  return (
    <Card title={kind === 'Tier' ? 'Tiers to unlock' : 'Bonus schemes to unlock'} sub="Closest to the next band first · the regions show where the counted students come from · from Commissions › Setup terms" flush action={<span className="ins-acts"><Seg label="Show" value={kind} items={[['Bonus scheme', 'Bonus schemes'], ['Tier', 'Standard tiers']]} onPick={setKind} /><CsvButton name="bonus-tracking" rows={rows} cols={cols} /></span>}>
      <Table rows={rows} cols={cols} rowKey={(r) => r.u.id} empty="No schemes in their counting window." />
    </Card>
  );
}

/* IP & RP analysis (Suman, Lav): revenue, RP cost, margin and lifetime value per student */
function Margins({ res, aud, s, now }: { res: Result; aud: Aud; s: InsightSettings; now: number }) {
  const [basis, setBasis] = useState<'paid' | 'billed' | 'all'>('billed');
  const [by, setBy] = useState<'ip' | 'uni' | 'rp' | 'level'>('ip');
  const since = new Date(now);
  since.setMonth(since.getMonth() - s.analysisMonths);
  const from = since.toISOString().slice(0, 10);
  const inWindow = (t: Tx) => t.trigger >= from;
  // which lines count: paid only; invoiced or paid; or everything expected (not the ones that don't count)
  const counts = (t: Tx) => {
    const g = groupOf(t.side, t.status);
    if (g === 'none') return false;
    if (basis === 'paid') return g === 'paid';
    if (basis === 'billed') return g === 'paid' || (t.side === 'uni' ? !!t.invoice : (ACTION_FROM.pay as readonly string[]).includes(t.status));
    return true;
  };
  const lines = res.txs.filter((t) => inWindow(t) && counts(t));
  const key = (t: Tx) => ({ ip: ipOf(t.uni), uni: t.uniName, rp: t.rpName, level: t.level })[by];
  const groups = new Map<string, Tx[]>();
  lines.forEach((t) => groups.set(key(t), [...(groups.get(key(t)) ?? []), t]));
  const isBonus = (t: Tx) => !s.directTypes.includes(t.type);
  const lifeBy = new Map<string, { paid: number; students: number }>();
  {
    const paidUni = res.txs.filter((t) => t.side === 'uni' && groupOf(t.side, t.status) === 'paid');
    const g = new Map<string, Tx[]>();
    paidUni.forEach((t) => g.set(key(t), [...(g.get(key(t)) ?? []), t]));
    g.forEach((l, k) => lifeBy.set(k, { paid: l.reduce((a, t) => a + aud(t.amount, t.currency), 0), students: new Set(l.map((t) => t.app)).size }));
  }
  const rows = [...groups.entries()].map(([k, l]) => {
    const uni = l.filter((t) => t.side === 'uni');
    const rp = l.filter((t) => t.side === 'rp');
    const direct = uni.filter((t) => !isBonus(t)).reduce((a, t) => a + aud(t.amount, t.currency), 0);
    const bonus = uni.filter(isBonus).reduce((a, t) => a + aud(t.amount, t.currency), 0);
    const cos = rp.reduce((a, t) => a + aud(t.amount, t.currency), 0);
    const students = new Set(l.map((t) => t.app)).size;
    const gross = direct + bonus;
    // R161 (Jovial, 18 Nov): lifetime value = commission received (paid University → GSP lines) since the start, per student
    const life = lifeBy.get(k);
    return { k, direct, bonus, gross, cos, students, margin: gross - cos, ltv: life && life.students ? life.paid / life.students : 0, perStudent: students ? (gross - cos) / students : 0 };
  }).sort((a, b) => b.gross - a.gross);
  type R = (typeof rows)[number];
  const m = (x: number) => Math.round(x).toLocaleString('en-GB');
  const cols: Col<R>[] = [
    { h: { ip: 'Institution partner', uni: 'University', rp: 'RP', level: 'Course level' }[by], v: (r) => r.k },
    { h: 'Students', n: true, v: (r) => r.students },
    { h: 'Direct commission', n: true, v: (r) => m(r.direct), csv: (r) => Math.round(r.direct) },
    { h: 'Bonus / additional', n: true, v: (r) => m(r.bonus), csv: (r) => Math.round(r.bonus) },
    { h: 'Gross revenue', n: true, v: (r) => m(r.gross), csv: (r) => Math.round(r.gross) },
    { h: 'RP COS', n: true, v: (r) => m(r.cos), csv: (r) => Math.round(r.cos) },
    { h: 'RP COS %', n: true, v: (r) => pct(rate(r.cos, r.gross)) },
    { h: 'Margin', n: true, v: (r) => m(r.margin), csv: (r) => Math.round(r.margin) },
    { h: 'Margin %', n: true, v: (r) => pct(rate(r.margin, r.gross)) },
    { h: 'LTV per student (received, since the start)', n: true, v: (r) => m(r.ltv), csv: (r) => Math.round(r.ltv) },
    { h: 'Margin per student', n: true, v: (r) => <span className={r.perStudent < s.marginPerStudent ? '' : 'cfg__strong'}>{m(r.perStudent)}</span>, csv: (r) => Math.round(r.perStudent) },
  ];
  const good = rows.filter((r) => r.perStudent >= s.marginPerStudent);
  return (
    <>
      <div className="ins-stats">
        <div className="ins-stat"><span className="ins-stat__k">Gross revenue</span><span className="ins-stat__n">{money(rows.reduce((a, r) => a + r.gross, 0))}</span><span className="ins-stat__sub">last {s.analysisMonths} months</span></div>
        <div className="ins-stat"><span className="ins-stat__k">RP COS</span><span className="ins-stat__n">{money(rows.reduce((a, r) => a + r.cos, 0))}</span></div>
        <div className="ins-stat"><span className="ins-stat__k">Margin</span><span className="ins-stat__n">{money(rows.reduce((a, r) => a + r.margin, 0))}</span></div>
        <div className="ins-stat"><span className="ins-stat__k">{`Margin ≥ AUD ${s.marginPerStudent}/student`}</span><span className="ins-stat__n">{good.length}</span><span className="ins-stat__sub">of {rows.length}</span></div>
      </div>
      <Card title="Revenue, RP cost and margin" sub={`Lines with a payable date in the last ${s.analysisMonths} months (a setting) · ${basis === 'paid' ? 'paid only' : basis === 'billed' ? 'invoiced or paid' : 'everything expected'} (Lav to confirm which)`} flush action={<span className="ins-acts"><Seg label="Count" value={basis} items={[['paid', 'Paid'], ['billed', 'Invoiced or paid'], ['all', 'All expected']]} onPick={setBasis} /><Seg label="By" value={by} items={[['ip', 'IP'], ['uni', 'University'], ['rp', 'RP'], ['level', 'Course level']]} onPick={setBy} /><CsvButton name="ip-rp-analysis" rows={rows} cols={cols} /></span>}>
        <Table rows={rows} cols={cols} rowKey={(r) => r.k} />
      </Card>
    </>
  );
}
