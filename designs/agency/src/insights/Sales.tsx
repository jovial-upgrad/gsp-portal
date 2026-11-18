import { useMemo, useState } from 'react';
import { PageHead } from '../institution/records/parts';
import type { Reporting, RepApp } from './data';
import { reachedAt, applyFilters, convRow, daysSince, expected, fyOf, groupBy, intakeText, isLive, lastChange, milestoneOf, msOf, pct, rate, regionalManagers, series, stageRates, uniOf, type Filters, type Grain, type InsightSettings } from './metrics';
import { targetFor, type TargetVersion } from './targets';
import type { CourseRec } from '../institution/data/catalogue';
import type { BdmRow } from '../admin/data/config';
import { Card, CsvButton, Drill, FilterBar, Num, Seg, Stat, Table, Tabs, TimeBars, useDrill, type Col } from './parts';

type Tab = 'tracker' | 'rps' | 'earn' | 'conv' | 'gen' | 'rpview';
const TABS: [Tab, string][] = [
  ['tracker', 'Sales tracker'],
  ['rps', 'RP tracker'],
  ['earn', 'Potential to earn'],
  ['conv', 'Conversions'],
  ['gen', 'App generation'],
  ['rpview', 'An RP’s view'],
];

/** Sales dashboards (round 3, 18 Nov): targets by regional manager and BDM, RP activity, incentives, conversions and app generation. */
export function Sales({ d, s, f, setF, now, target, courses, bdmRows }: { d: Reporting; s: InsightSettings; f: Filters; setF: (f: Filters) => void; now: number; target?: TargetVersion; courses: CourseRec[]; bdmRows: BdmRow[] }) {
  const [tab, setTab] = useState<Tab>('tracker');
  const apps = useMemo(() => applyFilters(d, f), [d, f]);
  const { drill, open, close } = useDrill();
  const n = (l: RepApp[], t: string) => <Num apps={l} open={open} title={t} />;
  return (
    <div className="ins">
      <PageHead title="Sales" lead="How each regional manager, BDM and RP is doing against target, and what's still to come. Every number opens the students behind it." />
      <FilterBar d={d} f={f} set={setF} />
      <Tabs label="Sales dashboards" value={tab} items={TABS} onPick={setTab} />
      {tab === 'tracker' && <Tracker d={d} apps={apps} s={s} f={f} now={now} n={n} open={open} target={target} courses={courses} bdmRows={bdmRows} />}
      {tab === 'rps' && <RpTracker d={d} apps={apps} s={s} now={now} n={n} open={open} />}
      {tab === 'earn' && <Earn d={d} apps={apps} all={d.apps} s={s} now={now} n={n} open={open} target={target} />}
      {tab === 'conv' && <Conversions d={d} apps={apps} s={s} n={n} open={open} />}
      {tab === 'gen' && <AppGen apps={apps} s={s} now={now} n={n} open={open} />}
      {tab === 'rpview' && <RpView d={d} apps={apps} s={s} now={now} n={n} open={open} />}
      <Drill open={!!drill} title={drill?.title ?? ''} apps={drill?.apps ?? []} d={d} s={s} now={now} onClose={close} />
    </div>
  );
}
type N = (l: RepApp[], t: string) => JSX.Element;
type O = (t: string, a: RepApp[]) => void;
const num = (x: number | null) => (x === null ? '—' : x.toLocaleString('en-GB', { maximumFractionDigits: 1 }));

/* Sales tracker: regional manager → BDM, actuals against the current targets */
function Tracker({ d, apps, s, f, now, n, open, target, courses, bdmRows }: { d: Reporting; apps: RepApp[]; s: InsightSettings; f: Filters; now: number; n: N; open: O; target?: TargetVersion; courses: CourseRec[]; bdmRows: BdmRow[] }) {
  const months = f.intake.length ? f.intake : undefined;
  // days left: to the deposit deadline of the intake picked, else to the end of this financial quarter
  const today = new Date(now).toISOString().slice(0, 10);
  // Jovial, 18 Nov: the deposit deadline comes from the course intakes themselves (Course › Intakes: deposit date):
  // the earliest still ahead among the filtered applications' courses for the intake picked
  const monthKey = (m: string) => {
    const x = new Date(`1 ${m}`);
    return isNaN(x.getTime()) ? m : `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  };
  const used = new Set(apps.map((a) => a.course));
  const dl =
    months?.length === 1
      ? courses
          .filter((c) => used.has(c.id))
          .flatMap((c) => Object.entries(c.dates ?? {}).filter(([m, x]) => monthKey(m) === months[0] && !!x.deposit && x.deposit >= today).map(([, x]) => x.deposit))
          .sort()[0]
      : undefined;
  // the BDM's own cities (Admin › Recruitment › BDM assignment; a row with no city covers its states, or its country)
  const citiesOf = (bdm: string) => [...new Set(bdmRows.filter((r) => r.bdm && (bdm === r.bdm || bdm.startsWith(`${r.bdm} `))).map((r) => r.city || r.state || r.country))].join(', ');
  const qEnd = (() => {
    const dd = new Date(now);
    const m = dd.getMonth();
    const end = new Date(dd.getFullYear(), m - (m % 3) + 3, 0);
    return end.toISOString().slice(0, 10);
  })();
  const until = dl ?? qEnd;
  const days = Math.max(1, Math.ceil((new Date(`${until}T23:59:00`).getTime() - now) / 86_400_000));
  const KEYS = ['submitted', 'offer', 'deposit', 'enroldoc', 'enrolled'] as const;
  const rms = regionalManagers(d.queues, d.users, d.regions);
  const rmOf = (bdm: string) => [...rms.entries()].find(([, p]) => p.has(bdm))?.[0] ?? '';
  const byBdm = [...groupBy(apps, (a) => a.bdm).entries()].map(([bdm, l]) => {
    const c = convRow(l, s);
    const got: Record<string, RepApp[]> = { submitted: c.submitted, offer: c.offers, deposit: c.deposits, enroldoc: c.enroldoc, enrolled: c.enrolled };
    const tg = Object.fromEntries(KEYS.map((k) => [k, targetFor(target, 'BDM', bdm, k, months)]));
    return { bdm, rm: rmOf(bdm), region: l[0].region, city: citiesOf(bdm), l, got, tg };
  });
  // a regional manager's row adds up their BDMs
  const gm = new Map<string, typeof byBdm>();
  byBdm.forEach((x) => gm.set(x.rm || x.region, [...(gm.get(x.rm || x.region) ?? []), x]));
  const groups = [...gm.entries()].sort((a, b) => b[1].length - a[1].length);
  type R = (typeof byBdm)[number] & { head?: boolean; label: string };
  const sum = (l: typeof byBdm, k: string) => l.flatMap((x) => x.got[k]);
  const tsum = (l: typeof byBdm, k: string) => (l.some((x) => x.tg[k] !== null) ? l.reduce((t, x) => t + (x.tg[k] ?? 0), 0) : null);
  const rows: R[] = groups.flatMap(([key, l]) => [
    { ...l[0], bdm: key, label: key, head: true, l: l.flatMap((x) => x.l), got: Object.fromEntries(KEYS.map((k) => [k, sum(l, k)])), tg: Object.fromEntries(KEYS.map((k) => [k, tsum(l, k)])) } as R,
    ...l.sort((a, b) => b.l.length - a.l.length).map((x) => ({ ...x, label: x.bdm })),
  ]);
  const ach = (r: R, k: string) => rate(r.got[k].length, r.tg[k] ?? 0);
  const gap = (r: R, k: string) => (r.tg[k] === null ? null : Math.max(0, r.tg[k]! - r.got[k].length));
  const col = (k: (typeof KEYS)[number], label: string): Col<R>[] => [
    { h: label, n: true, v: (r) => n(r.got[k], `${r.label}: ${label.toLowerCase()}`), csv: (r) => r.got[k].length },
    { h: `${label} target`, n: true, v: (r) => num(r.tg[k]), csv: (r) => r.tg[k] ?? '' },
    { h: 'Ach %', n: true, v: (r) => (r.tg[k] ? pct(ach(r, k)) : '—') },
    { h: 'Need/day', n: true, v: (r) => (gap(r, k) === null ? '—' : num(gap(r, k)! / days)) },
  ];
  const cols: Col<R>[] = [
    { h: 'Regional manager / BDM', v: (r) => (r.head ? <strong>{r.label}</strong> : <span style={{ paddingLeft: 16 }}>{r.label}</span>) },
    { h: 'City', v: (r) => (r.head ? '' : r.city) },
    { h: 'Applications', n: true, v: (r) => n(r.l, `${r.label}: applications`), csv: (r) => r.l.length },
    ...col('submitted', msOf(s, 'submitted').label),
    ...col('offer', msOf(s, 'offer').label),
    ...col('deposit', msOf(s, 'deposit').label),
    { h: msOf(s, 'enroldoc').label, n: true, v: (r) => n(r.got.enroldoc, `${r.label}: ${msOf(s, 'enroldoc').label}`), csv: (r) => r.got.enroldoc.length },
    { h: msOf(s, 'enrolled').label, n: true, v: (r) => n(r.got.enrolled, `${r.label}: ${msOf(s, 'enrolled').label}`), csv: (r) => r.got.enrolled.length },
    { h: `${msOf(s, 'enrolled').label} target`, n: true, v: (r) => num(r.tg.enrolled) },
  ];
  const top = (k: (typeof KEYS)[number]) => {
    const got = byBdm.flatMap((x) => x.got[k]);
    const tg = tsum(byBdm, k);
    return { got, tg };
  };
  return (
    <>
      <div className="ins-stats">
        {KEYS.map((k) => [k, `${msOf(s, k).label} vs target`] as const).map(([k, t]) => {
          const x = top(k);
          return <Stat key={k} title={t} apps={x.got} count={`${x.got.length.toLocaleString('en-GB')}${x.tg !== null ? ` / ${x.tg.toLocaleString('en-GB')}` : ''}`} sub={x.tg ? `${pct(rate(x.got.length, x.tg))} · need ${num(Math.max(0, x.tg - x.got.length) / days)}/day` : 'No BDM targets for this view'} open={open} />;
        })}
        <Stat title="Days left" apps={[]} count={String(days)} sub={dl ? `to the earliest deposit deadline of the ${intakeText(months![0])} intake (its courses' intake dates)` : 'to the end of this quarter'} open={open} />
      </div>
      <Card title="By regional manager and BDM" sub={`Targets: ${target ? `${target.name} (current version)` : 'no current version'}${months ? `, for ${months.map(intakeText).join(', ')}` : ''} · today ${today}`} flush action={<CsvButton name="sales-tracker" rows={rows} cols={cols} />}>
        <Table rows={rows} cols={cols} rowKey={(r) => `${r.head ? 'h' : 'b'}|${r.label}`} />
      </Card>
    </>
  );
}

/* RP tracker: activity by when each RP last sent an application */
function RpTracker({ d, apps, s, now, n, open }: { d: Reporting; apps: RepApp[]; s: InsightSettings; now: number; n: N; open: O }) {
  const [q, setQ] = useState('');
  const month = (t: number) => new Date(t).toISOString().slice(0, 7);
  const m0 = month(now);
  const back = (k: number) => {
    const x = new Date(now);
    x.setMonth(x.getMonth() - k);
    return month(x.getTime());
  };
  const rows = [...groupBy(apps, (a) => a.rp).entries()].map(([id, l]) => {
    const rp = d.rps.find((x) => x.id === id)!;
    const last = Math.max(...l.map((a) => a.created));
    const lm = month(last);
    const bucket = lm === m0 ? 'This month' : lm === back(1) ? 'M-1' : lm === back(2) ? 'M-2' : 'M-2++';
    const c = convRow(l, s);
    return { rp, l, c, last, bucket, thisMonth: l.filter((a) => month(a.created) === m0), idle: l.filter((a) => isLive(a) && daysSince(lastChange(a), now) >= s.idleDays) };
  }).sort((a, b) => b.l.length - a.l.length);
  const shown = rows.filter((r) => !q || `${r.rp.name} ${r.rp.bdm} ${r.rp.state}`.toLowerCase().includes(q.toLowerCase()));
  const pick = (b: string) => rows.filter((r) => r.bucket === b).flatMap((r) => r.l);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: 'RP', v: (r) => r.rp.name },
    { h: 'State', v: (r) => r.rp.state || r.rp.country },
    { h: 'BDM', v: (r) => r.rp.bdm },
    { h: 'Applications', n: true, v: (r) => n(r.l, `${r.rp.name}: applications`), csv: (r) => r.l.length },
    { h: 'This month', n: true, v: (r) => n(r.thisMonth, `${r.rp.name}: this month`), csv: (r) => r.thisMonth.length },
    { h: 'Submitted', n: true, v: (r) => n(r.c.submitted, `${r.rp.name}: submitted`), csv: (r) => r.c.submitted.length },
    { h: 'Offers', n: true, v: (r) => n(r.c.offers, `${r.rp.name}: offers`), csv: (r) => r.c.offers.length },
    { h: 'Deposits', n: true, v: (r) => n(r.c.deposits, `${r.rp.name}: deposits`), csv: (r) => r.c.deposits.length },
    { h: 'Enrolled', n: true, v: (r) => n(r.c.enrolled, `${r.rp.name}: enrolled`), csv: (r) => r.c.enrolled.length },
    { h: 'Last application', v: (r) => new Date(r.last).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) },
    { h: 'Activity', v: (r) => r.bucket },
    { h: `Idle ${s.idleDays}+`, n: true, v: (r) => n(r.idle, `${r.rp.name}: idle students`), csv: (r) => r.idle.length },
  ];
  return (
    <>
      <div className="ins-stats">
        <Stat title="RPs with applications" apps={apps} count={rows.length} sub="In the current filter" open={open} />
        <Stat title="Sent this month" apps={pick('This month')} count={rows.filter((r) => r.bucket === 'This month').length} sub={`${pct(rate(rows.filter((r) => r.bucket === 'This month').length, rows.length), 0)} of RPs`} open={open} />
        <Stat title="Last application M-1" apps={pick('M-1')} count={rows.filter((r) => r.bucket === 'M-1').length} open={open} />
        <Stat title="Last application M-2" apps={pick('M-2')} count={rows.filter((r) => r.bucket === 'M-2').length} open={open} />
        <Stat title="Last application M-2++" apps={pick('M-2++')} count={rows.filter((r) => r.bucket === 'M-2++').length} open={open} />
        <Stat title="RPs with idle students" apps={rows.flatMap((r) => r.idle)} count={rows.filter((r) => r.idle.length).length} sub={`idle ${s.idleDays}+ days`} open={open} />
      </div>
      <Card title="RP performance" sub="The last application decides the activity bucket" flush action={<span className="ins-acts"><input className="ins-input" style={{ width: 220 }} type="search" placeholder="Search RP, BDM, state" aria-label="Search RPs" value={q} onChange={(e) => setQ(e.target.value)} /><CsvButton name="rp-tracker" rows={shown} cols={cols} /></span>}>
        <Table rows={shown.slice(0, 150)} cols={cols} rowKey={(r) => r.rp.id} />
      </Card>
    </>
  );
}

/* Potential to earn: the incentive per admission, changed live to try other amounts in a conversation */
function Earn({ d, apps, all, s, now, n, open, target }: { d: Reporting; apps: RepApp[]; all: RepApp[]; s: InsightSettings; now: number; n: N; open: O; target?: TargetVersion }) {
  const [amt, setAmt] = useState(s.incentive.amount);
  const [who, setWho] = useState<'bdm' | 'rp'>('bdm');
  const adm = msOf(s, s.incentive.milestone);
  const rates = useMemo(() => stageRates(all, s, now), [all, s, now]);
  const rpName = new Map(d.rps.map((x) => [x.id, x.name]));
  const money = (x: number) => `${s.incentive.currency} ${Math.round(x).toLocaleString('en-IN')}`;
  const rows = [...groupBy(apps, (a) => (who === 'bdm' ? a.bdm : a.rp)).entries()].map(([k, l]) => {
    const c = convRow(l, s);
    // Jovial, 18 Nov: an admission is the setting's checkpoint; the in-hand pipeline is a live deposit not yet admitted
    const got = l.filter((a) => reachedAt(a, adm.status) !== undefined);
    const tg = who === 'bdm' ? targetFor(target, 'BDM', k, s.incentive.milestone) : null;
    const dep = c.deposits.filter((a) => isLive(a) && reachedAt(a, adm.status) === undefined);
    const trend = expected(l.filter(isLive), s, rates);
    return { k, label: who === 'bdm' ? k : rpName.get(k) ?? k, l, got, tg, dep, trend };
  }).sort((a, b) => (b.tg ?? 0) - (a.tg ?? 0) || b.l.length - a.l.length);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: who === 'bdm' ? 'BDM' : 'RP', v: (r) => r.label },
    { h: 'Applications', n: true, v: (r) => n(r.l, `${r.label}: applications`), csv: (r) => r.l.length },
    { h: 'Admissions', n: true, v: (r) => n(r.got, `${r.label}: admissions`), csv: (r) => r.got.length },
    { h: 'Earned', n: true, v: (r) => money(r.got.length * amt) },
    ...(who === 'bdm'
      ? ([
          { h: 'Target', n: true, v: (r) => num(r.tg) },
          { h: 'Gap', n: true, v: (r) => (r.tg === null ? '—' : num(Math.max(0, r.tg - r.got.length))) },
          { h: 'Potential (gap)', n: true, v: (r) => (r.tg === null ? '—' : money(Math.max(0, r.tg - r.got.length) * amt)) },
        ] as Col<R>[])
      : []),
    { h: `${msOf(s, 'deposit').label}, not yet ${adm.label}`, n: true, v: (r) => n(r.dep, `${r.label}: deposited, not yet admitted`), csv: (r) => r.dep.length },
    { h: 'Pipeline', n: true, v: (r) => money(r.dep.length * amt) },
    { h: 'Trend admissions', n: true, v: (r) => num(r.trend) },
    { h: 'At trend', n: true, v: (r) => money(r.trend * amt) },
  ];
  const earned = rows.reduce((t, r) => t + r.got.length, 0);
  const gapAll = rows.reduce((t, r) => t + (r.tg === null ? 0 : Math.max(0, r.tg - r.got.length)), 0);
  const pipe = rows.flatMap((r) => r.dep);
  const trend = rows.reduce((t, r) => t + r.trend, 0);
  return (
    <>
      <Card title="Incentive per admission" sub={`An admission: ${adm.label}. Change the amount to try another in a conversation; it isn't saved (the default is a setting).`} action={<span className="ins-acts"><label className="ins-note" htmlFor="ie-amt">{s.incentive.currency}</label><input id="ie-amt" className="ins-input" type="number" min={0} step={500} value={amt} onChange={(e) => setAmt(Math.max(0, +e.target.value || 0))} /><Seg label="For" value={who} items={[['bdm', 'BDM'], ['rp', 'RP']]} onPick={setWho} /></span>}>
        <div className="ins-stats">
          <Stat title="Earned" apps={rows.flatMap((r) => r.got)} count={money(earned * amt)} sub={`${earned} admissions`} open={open} />
          {who === 'bdm' && <Stat title="Potential to earn" apps={[]} count={money(gapAll * amt)} sub="Target − earned, summed per BDM" open={open} />}
          <Stat title="In-hand pipeline" apps={pipe} count={money(pipe.length * amt)} sub={`${pipe.length} deposited, not yet ${adm.label}`} open={open} />
          <Stat title="At current trend" apps={[]} count={money(trend * amt)} sub={`≈ ${Math.round(trend)} more admissions expected`} open={open} />
        </div>
      </Card>
      <Card title={who === 'bdm' ? 'BDM earnings' : 'RP earnings'} sub={`Targets: ${target?.name ?? 'none'} · trend uses each live student's stage-to-enrolment rate over the last ${s.forecastMonths} months`} flush action={<CsvButton name="potential-to-earn" rows={rows} cols={cols} />}>
        <Table rows={rows.slice(0, 150)} cols={cols} rowKey={(r) => r.k} />
      </Card>
    </>
  );
}

/* Conversions: by any dimension */
type Dim = 'bdm' | 'rp' | 'country' | 'dest' | 'uni' | 'region';
const DIMS: [Dim, string][] = [['bdm', 'By BDM'], ['rp', 'By RP'], ['country', 'By source country'], ['dest', 'By destination'], ['uni', 'By university'], ['region', 'By sales region']];
function Conversions({ d, apps, s, n, open }: { d: Reporting; apps: RepApp[]; s: InsightSettings; n: N; open: O }) {
  const [dim, setDim] = useState<Dim>('bdm');
  const rpName = new Map(d.rps.map((x) => [x.id, x.name]));
  const key = (a: RepApp) => (dim === 'rp' ? rpName.get(a.rp) ?? a.rp : dim === 'uni' ? uniOf(a.uni) : a[dim]);
  const all = convRow(apps, s);
  const rows = [...groupBy(apps, key).entries()].map(([k, l]) => ({ k, c: convRow(l, s) })).sort((a, b) => b.c.apps.length - a.c.apps.length);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: DIMS.find((x) => x[0] === dim)![1].replace('By ', ''), v: (r) => r.k },
    { h: 'Applications', n: true, v: (r) => n(r.c.apps, `${r.k}: applications`), csv: (r) => r.c.apps.length },
    { h: 'Offers', n: true, v: (r) => n(r.c.offers, `${r.k}: offers`), csv: (r) => r.c.offers.length },
    { h: 'App → offer', n: true, v: (r) => pct(rate(r.c.offers.length, r.c.apps.length)) },
    { h: 'Deposits', n: true, v: (r) => n(r.c.deposits, `${r.k}: deposits`), csv: (r) => r.c.deposits.length },
    { h: 'Offer → deposit', n: true, v: (r) => pct(rate(r.c.deposits.length, r.c.offers.length)) },
    { h: 'Enrolled', n: true, v: (r) => n(r.c.enrolled, `${r.k}: enrolled`), csv: (r) => r.c.enrolled.length },
    { h: 'Deposit → enrolment', n: true, v: (r) => pct(rate(r.c.enrolled.length, r.c.deposits.length)) },
    { h: 'Live, not offered', n: true, v: (r) => n(r.c.liveNoOffer, `${r.k}: live, not offered`), csv: (r) => r.c.liveNoOffer.length },
  ];
  return (
    <>
      <div className="ins-stats">
        <Stat title="Application → offer" apps={all.offers} count={pct(rate(all.offers.length, all.apps.length))} sub={`${all.offers.length} of ${all.apps.length}`} open={open} />
        <Stat title="Offer → deposit" apps={all.deposits} count={pct(rate(all.deposits.length, all.offers.length))} sub={`${all.deposits.length} of ${all.offers.length}`} open={open} />
        <Stat title="Deposit → enrolment" apps={all.enrolled} count={pct(rate(all.enrolled.length, all.deposits.length))} sub={`${all.enrolled.length} of ${all.deposits.length}`} open={open} />
        <Stat title="Application → enrolment" apps={all.enrolled} count={pct(rate(all.enrolled.length, all.apps.length), 2)} sub={`${all.enrolled.length} of ${all.apps.length}`} open={open} />
      </div>
      <Card title="Conversion table" sub="Every number opens the students behind it" flush action={<span className="ins-acts"><Seg label="Group by" value={dim} items={DIMS} onPick={setDim} /><CsvButton name="conversions" rows={rows} cols={cols} /></span>}>
        <Table rows={rows.slice(0, 150)} cols={cols} rowKey={(r) => r.k} />
      </Card>
    </>
  );
}

/* App generation (Ashray): applications by day, week or month, split by a dimension */
type GDim = 'region' | 'bdm' | 'uni' | 'intake';
function AppGen({ apps, s, now, n, open }: { apps: RepApp[]; s: InsightSettings; now: number; n: N; open: O }) {
  const [g, setG] = useState<Grain>('week');
  const [dim, setDim] = useState<GDim>('region');
  const [run, setRun] = useState<'per' | 'run'>('per');
  const last = g === 'day' ? 14 : 12;
  const pts = series(apps, (a) => a.created, g, now, last);
  const key = (a: RepApp) => (dim === 'uni' ? uniOf(a.uni) : dim === 'intake' ? intakeText(a.intake) : a[dim]);
  const label = (t: number) => new Date(t).toLocaleDateString('en-GB', g === 'month' ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' });
  const names = [...groupBy(pts.flatMap((p) => p.apps), key).entries()].sort((a, b) => b[1].length - a[1].length).map(([k]) => k);
  type R = { k: string; per: RepApp[][] };
  const rows: R[] = [...names.map((k) => ({ k, per: pts.map((p) => p.apps.filter((a) => key(a) === k)) })), { k: 'Total', per: pts.map((p) => p.apps) }];
  const cols: Col<R>[] = [
    { h: { region: 'Sales region', bdm: 'BDM', uni: 'University', intake: 'Commencement' }[dim], v: (r) => (r.k === 'Total' ? <strong>Total</strong> : r.k) },
    ...pts.map((p, i): Col<R> => ({ h: label(p.at), n: true, v: (r) => n(r.per[i], `${r.k}, ${label(p.at)}`), csv: (r) => r.per[i].length })),
    { h: 'All', n: true, v: (r) => n(r.per.flat(), `${r.k}: all`), csv: (r) => r.per.flat().length },
  ];
  return (
    <>
      <Card title="Applications generated" sub="By the date each was received" action={<span className="ins-acts"><Seg label="Show" value={run} items={[['per', 'Per period'], ['run', 'Running total']]} onPick={setRun} /><Seg label="Group by" value={g} items={[['day', 'Day'], ['week', 'Week'], ['month', 'Month']]} onPick={setG} /></span>}>
        <TimeBars points={series(apps, (a) => a.created, g, now, g === 'day' ? 60 : g === 'week' ? 52 : undefined)} grain={g} running={run === 'run'} label="Applications received" open={open} />
      </Card>
      <Card title={`The last ${last} ${g === 'day' ? 'days' : g === 'week' ? 'weeks' : 'months'}`} flush action={<span className="ins-acts"><Seg label="Split by" value={dim} items={[['region', 'Sales region'], ['bdm', 'BDM'], ['uni', 'University'], ['intake', 'Commencement month']]} onPick={setDim} /><CsvButton name="app-generation" rows={rows} cols={cols} /></span>}>
        <Table rows={rows} cols={cols} rowKey={(r) => r.k} />
      </Card>
      <p className="ins-note">{`Financial year ${fyOf(new Date(now).toISOString().slice(0, 7), s.fyStartMonth).fy}.`}</p>
    </>
  );
}

/* An RP's own view, as the RP would see it on its portal */
function RpView({ d, apps, s, now, n, open }: { d: Reporting; apps: RepApp[]; s: InsightSettings; now: number; n: N; open: O }) {
  const byRp = [...groupBy(apps, (a) => a.rp).entries()].sort((a, b) => b[1].length - a[1].length);
  const [id, setId] = useState(byRp[0]?.[0] ?? '');
  const rp = d.rps.find((x) => x.id === id);
  const l = apps.filter((a) => a.rp === id);
  const c = convRow(l, s);
  const idle = l.filter((a) => isLive(a) && daysSince(lastChange(a), now) >= s.idleDays);
  const cols: Col<RepApp>[] = [
    { h: 'Application', v: (a) => a.id },
    { h: 'University', v: (a) => uniOf(a.uni) },
    { h: 'Destination', v: (a) => a.dest },
    { h: 'Stage', v: (a) => milestoneOf(a, s.milestones).label },
    { h: 'Days idle', n: true, v: (a) => daysSince(lastChange(a), now) },
  ];
  return (
    <>
      <label className="ins-acts">
        <span className="ins-note">Preview as RP</span>
        <select className="ins-input" style={{ width: 320 }} value={id} onChange={(e) => setId(e.target.value)}>
          {byRp.map(([k, x]) => (
            <option key={k} value={k}>
              {`${d.rps.find((r) => r.id === k)?.name} · ${x.length} applications`}
            </option>
          ))}
        </select>
      </label>
      {rp && (
        <>
          <Card title={rp.name} sub={`${rp.city}${rp.state ? `, ${rp.state}` : ''} · BDM ${rp.bdm} · all intakes`}>
            <div className="ins-stats">
              <Stat title="Applications" apps={c.apps} sub={`${c.live.length} in progress`} open={open} />
              <Stat title="Offers" apps={c.offers} sub={`${pct(rate(c.offers.length, c.apps.length))} of applications`} open={open} />
              <Stat title="Deposits" apps={c.deposits} sub={`${pct(rate(c.deposits.length, c.offers.length))} of offers`} open={open} />
              <Stat title="Enrolled" apps={c.enrolled} sub={`${pct(rate(c.enrolled.length, c.deposits.length))} of deposits`} open={open} />
              <Stat title="Needs action" apps={idle} sub={`idle ${s.idleDays}+ days`} open={open} />
            </div>
          </Card>
          <Card title="Students needing action" sub={`No status change for ${s.idleDays}+ days`} flush>
            <Table rows={[...idle].sort((a, b) => lastChange(a) - lastChange(b)).slice(0, 50)} cols={cols} rowKey={(a) => a.id} empty="Nothing waiting." />
          </Card>
        </>
      )}
      {void n}
    </>
  );
}
