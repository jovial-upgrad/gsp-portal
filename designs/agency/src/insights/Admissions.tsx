import { useMemo, useState } from 'react';
import { PageHead } from '../institution/records/parts';
import { ENROL_DOC, STAGES, STATUS } from '../data/applications';
import { COURSE_STATUSES, type CourseRec } from '../institution/data/catalogue';
/** A course students can apply to: the catalogue's first status. */
const LIVE = COURSE_STATUSES[0];
import type { Reporting, RepApp } from './data';
import { applyFilters, between, convRow, courseOf, daysSince, groupBy, isLive, lastChange, msOf, pct, rate, reachedAt, rejectionKinds, stageNow, stageSince, uniOf, type Filters, type InsightSettings } from './metrics';
import type { CloseReasons } from '../admin/data/config';
import type { Unlock } from '../finance/commission/engine';
import { targetFor, type TargetVersion } from './targets';
import { AppLink, Card, CsvButton, Drill, FilterBar, Num, Seg, Stat, Table, Tabs, statusOf, useDrill, type Col } from './parts';

type Tab = 'tracker' | 'pipeline' | 'pre' | 'post' | 'offers' | 'docs' | 'visa' | 'interview' | 'reports';
const TABS: [Tab, string][] = [
  ['tracker', 'University tracker'],
  ['pipeline', 'Pipeline & ageing'],
  ['pre', 'Pre-submission'],
  ['post', 'Post-submission'],
  ['offers', 'Offers'],
  ['docs', 'CAS / I-20 / CoE'],
  ['visa', 'Deposit → visa'],
  ['interview', 'Interview tracker'],
  ['reports', 'Reports'],
];

/**
 * Admissions dashboards (round 2, 18 Nov): Ramish's university tracker, the India team's pipeline, submission, offer,
 * CoE and visa views, the Interview tracker and Ali's four reports. Every number opens its students.
 */
export function Admissions({ d, s, f, setF, now, unlocks, courses, target, closeReasons }: { d: Reporting; s: InsightSettings; f: Filters; setF: (f: Filters) => void; now: number; unlocks: Unlock[]; courses: CourseRec[]; target?: TargetVersion; closeReasons: CloseReasons[] }) {
  const rejects = useMemo(() => rejectionKinds(closeReasons), [closeReasons]);
  const [tab, setTab] = useState<Tab>('tracker');
  const apps = useMemo(() => applyFilters(d, f), [d, f]);
  const { drill, open, close } = useDrill();
  const n = (l: RepApp[], t: string) => <Num apps={l} open={open} title={t} />;
  return (
    <div className="ins">
      <PageHead title="Admissions" lead="Applications by university and stage, how long they wait, and what to chase. Every number opens the students behind it." />
      <FilterBar d={d} f={f} set={setF} />
      <Tabs label="Admissions dashboards" value={tab} items={TABS} onPick={setTab} />
      {tab === 'tracker' && <Tracker apps={apps} s={s} n={n} unlocks={unlocks} target={target} />}
      {tab === 'pipeline' && <Pipeline apps={apps} s={s} now={now} n={n} open={open} d={d} />}
      {tab === 'pre' && <PreSub apps={apps} s={s} now={now} n={n} open={open} d={d} />}
      {tab === 'post' && <PostSub apps={apps} s={s} now={now} n={n} open={open} />}
      {tab === 'offers' && <Offers apps={apps} s={s} n={n} open={open} />}
      {tab === 'docs' && <EnrolDocs apps={apps} s={s} now={now} n={n} open={open} />}
      {tab === 'visa' && <Visa apps={apps} s={s} now={now} n={n} open={open} d={d} />}
      {tab === 'interview' && <Interviews apps={apps} s={s} now={now} d={d} rejects={rejects} />}
      {tab === 'reports' && <Reports apps={apps} s={s} now={now} n={n} courses={courses} rejects={rejects} />}
      <Drill open={!!drill} title={drill?.title ?? ''} apps={drill?.apps ?? []} d={d} s={s} now={now} onClose={close} />
    </div>
  );
}
type N = (l: RepApp[], t: string) => JSX.Element;

/* Ramish's university-wise tracker, with what's needed for the top commission slab */
function Tracker({ apps, s, n, unlocks, target }: { apps: RepApp[]; s: InsightSettings; n: N; unlocks: Unlock[]; target?: TargetVersion }) {
  // Jovial, 18 Nov: the top slab and how many more it needs, from the commission rules (the same count as Finance's
  // Bonus tracking): the university's own tier, else its IP group's, in the tier's own counting window
  const tierOf = (uni: string) => unlocks.find((u) => u.kind === 'Tier' && u.who === 'university' && u.unis.includes(uni)) ?? unlocks.find((u) => u.kind === 'Tier' && u.unis.includes(uni));
  const rows = [...groupBy(apps, (a) => a.uni).entries()]
    .map(([uni, l]) => {
      const c = convRow(l, s);
      const t = tierOf(uni);
      const top = t?.bands[t.bands.length - 1];
      const tgt = targetFor(target, 'University', uniOf(uni), 'enrolled');
      return { uni, name: uniOf(uni), dest: l[0].dest, c, top: top?.from ?? null, need: top ? top.more : null, tier: t ? `${t.name}, ${t.window}, ${t.count} counted` : '', tgt };
    })
    .sort((a, b) => b.c.apps.length - a.c.apps.length);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: 'University', v: (r) => r.name },
    { h: 'Country', v: (r) => r.dest },
    { h: 'Applications', n: true, v: (r) => n(r.c.apps, `${r.name}: applications`), csv: (r) => r.c.apps.length },
    { h: 'Offers', n: true, v: (r) => n(r.c.offers, `${r.name}: offers`), csv: (r) => r.c.offers.length },
    { h: 'App → offer', n: true, v: (r) => pct(rate(r.c.offers.length, r.c.apps.length)) },
    { h: 'Deposits', n: true, v: (r) => n(r.c.deposits, `${r.name}: deposits`), csv: (r) => r.c.deposits.length },
    { h: 'App → deposit', n: true, v: (r) => pct(rate(r.c.deposits.length, r.c.apps.length)) },
    { h: msOf(s, 'enroldoc').label, n: true, v: (r) => n(r.c.enroldoc, `${r.name}: ${ENROL_DOC[r.dest]} issued`), csv: (r) => r.c.enroldoc.length },
    { h: 'Enrolments', n: true, v: (r) => n(r.c.enrolled, `${r.name}: enrolled`), csv: (r) => r.c.enrolled.length },
    { h: 'Enrolment target', n: true, v: (r) => (r.tgt === null ? '—' : r.tgt.toLocaleString('en-GB')), csv: (r) => r.tgt ?? '' },
    { h: 'Needed for top slab', n: true, v: (r) => (r.need === null ? <span className="ins-note">No tiers</span> : <span title={`Top slab from ${r.top} enrolments · ${r.tier}`}>{r.need}</span>), csv: (r) => r.need ?? '' },
  ];
  return (
    <Card title="University performance tracker" sub="Per application, by university · Needed for top slab: from the commission rules (the university's tier, else its IP group's), counted in the tier's own window" flush action={<CsvButton name="university-tracker" rows={rows} cols={cols} />}>
      <Table rows={rows} cols={cols} rowKey={(r) => r.uni} />
    </Card>
  );
}

/* Pipeline & ageing: days since the last status change, or in the current stage, with the chase list */
function Pipeline({ apps, s, now, n, open, d }: { apps: RepApp[]; s: InsightSettings; now: number; n: N; open: (t: string, a: RepApp[]) => void; d: Reporting }) {
  const [basis, setBasis] = useState<'change' | 'stage'>('change');
  const [step, setStep] = useState(s.idleDays);
  const live = apps.filter(isLive);
  // days in the current stage: since the milestone it's at was reached
  const ageOf = (a: RepApp) => daysSince(basis === 'change' ? lastChange(a) : stageSince(a), now);
  const aged = live.filter((a) => ageOf(a) >= step);
  const b = s.ageBuckets;
  const bucket = (x: number) => b.reduce((k, lo, i) => (x >= lo ? i : k), 0);
  // Jovial, 18 Nov: rows are the lifecycle's stages, by each live application's current status
  const rows = STAGES.map((label, i) => ({ key: String(i), label, i }))
    .map((m) => {
      const here = live.filter((a) => stageNow(a) === m.i);
      const cells = b.map(() => [] as RepApp[]);
      here.forEach((a) => cells[bucket(ageOf(a))].push(a));
      return { m, here, cells, avg: here.length ? here.reduce((t, a) => t + ageOf(a), 0) / here.length : 0 };
    })
    .filter((r) => r.here.length);
  const labels = b.map((lo, i) => (i === b.length - 1 ? `${lo}+ d` : `${lo}–${b[i + 1] - 1} d`));
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: 'Stage', v: (r) => r.m.label },
    ...labels.map((l, i): Col<R> => ({ h: l, n: true, v: (r) => n(r.cells[i], `${r.m.label}, ${l}`), csv: (r) => r.cells[i].length })),
    { h: 'Total', n: true, v: (r) => n(r.here, `${r.m.label}: live`), csv: (r) => r.here.length },
    { h: 'Average', n: true, v: (r) => `${r.avg.toFixed(1)} d` },
  ];
  const rp = new Map(d.rps.map((x) => [x.id, x.name]));
  const chase = [...aged].sort((a, b2) => ageOf(b2) - ageOf(a)).slice(0, 50);
  const ccols: Col<RepApp>[] = [
    { h: 'Application', v: (a) => <AppLink a={a} d={d} now={now} />, csv: (a) => a.id },
    { h: 'University', v: (a) => uniOf(a.uni) },
    { h: 'Destination', v: (a) => a.dest },
    { h: 'Application BDM', v: (a) => a.bdm },
    { h: 'RP', v: (a) => rp.get(a.rp) ?? '' },
    { h: 'RP counsellor', v: (a) => a.counsellor },
    { h: 'Stage', v: (a) => STAGES[stageNow(a)] },
    { h: 'Status', v: (a) => STATUS[a.moves[a.moves.length - 1].s].text(a.dest) },
    { h: 'Days', n: true, v: (a) => ageOf(a) },
  ];
  return (
    <>
      <div className="ins-acts">
        <span className="ins-note">Ageing on</span>
        <Seg label="Ageing on" value={basis} items={[['change', 'Days since last status change'], ['stage', 'Days in current stage']]} onPick={setBasis} />
        <span className="ins-note">Show</span>
        <Seg label="Idle for" value={String(step)} items={s.idleSteps.map((x) => [String(x), `${x}+ days`] as [string, string])} onPick={(v) => setStep(+v)} />
      </div>
      <div className="ins-stats">
        <Stat title="Live applications" apps={live} sub="Not closed, not enrolled" open={open} />
        <Stat title={`Aged ${step}+ days`} apps={aged} sub={`${pct(rate(aged.length, live.length))} of live`} open={open} />
        {rows.slice(0, 4).map((r) => (
          <Stat key={r.m.key} title={`${r.m.label} · aged ${step}+ d`} apps={r.here.filter((a) => ageOf(a) >= step)} sub={`avg ${r.avg.toFixed(1)} d`} open={open} />
        ))}
      </div>
      <Card title="Ageing matrix" sub={basis === 'change' ? 'Live applications · days since last status change' : 'Live applications · days in the current stage'} flush action={<CsvButton name="ageing" rows={rows} cols={cols} />}>
        <Table rows={rows} cols={cols} rowKey={(r) => r.m.key} />
      </Card>
      <Card title={`Aged ${step}+ days · who to chase`} sub="Oldest first (the first 50; the tile opens them all)" flush action={<CsvButton name="chase-list" rows={aged} cols={ccols} />}>
        <Table rows={chase} cols={ccols} rowKey={(a) => a.id} />
      </Card>
    </>
  );
}

/* Pre-submission: received, not yet lodged */
function PreSub({ apps, s, now, n, open, d }: { apps: RepApp[]; s: InsightSettings; now: number; n: N; open: (t: string, a: RepApp[]) => void; d: Reporting }) {
  const sub = msOf(s, 'submitted').status;
  const pre = apps.filter((a) => isLive(a) && reachedAt(a, sub) === undefined);
  const zero = pre.filter((a) => a.docs === 0);
  const idle = pre.filter((a) => daysSince(lastChange(a), now) >= s.idleDays);
  const st = [...groupBy(pre, (a) => a.moves[a.moves.length - 1].s).entries()].map(([k, l]) => ({ k, l, label: statusOf(l[0]), docs: l.reduce((t, a) => t + a.docs, 0) / l.length, idle: l.filter((a) => daysSince(lastChange(a), now) >= s.idleDays) }));
  type R = (typeof st)[number];
  const cols: Col<R>[] = [
    { h: 'Status', v: (r) => r.label },
    { h: 'Applications', n: true, v: (r) => n(r.l, r.label), csv: (r) => r.l.length },
    { h: 'Average documents', n: true, v: (r) => r.docs.toFixed(1) },
    { h: `Idle ${s.idleDays}+`, n: true, v: (r) => n(r.idle, `${r.label}: idle`), csv: (r) => r.idle.length },
  ];
  const bands: [string, (x: number) => boolean][] = [['0', (x) => x === 0], ['1–3', (x) => x >= 1 && x <= 3], ['4–6', (x) => x >= 4 && x <= 6], ['7–9', (x) => x >= 7 && x <= 9], ['10+', (x) => x >= 10]];
  void d;
  return (
    <>
      <div className="ins-stats">
        <Stat title="Pre-submission" apps={pre} sub="Received, not yet lodged with the university" open={open} />
        <Stat title="No documents uploaded" apps={zero} sub={`${pct(rate(zero.length, pre.length))} of pre-submission`} open={open} />
        <Stat title={`Idle ${s.idleDays}+ days`} apps={idle} sub="Since the last status change" open={open} />
      </div>
      <div className="ins__grid">
        <Card title="By status" flush action={<CsvButton name="pre-submission" rows={st} cols={cols} />}>
          <Table rows={st} cols={cols} rowKey={(r) => r.k} />
        </Card>
        <Card title="Documents uploaded" sub="Documents on each pre-submission application">
          <table className="itab ins-tab">
            <tbody>
              {bands.map(([l, ok]) => {
                const here = pre.filter((a) => ok(a.docs));
                return (
                  <tr key={l}>
                    <td>{l} documents</td>
                    <td className="n">{n(here, `${l} documents`)}</td>
                    <td style={{ width: '50%' }}>
                      <span className="ins-bar" style={{ width: `${pre.length ? (here.length / pre.length) * 100 : 0}%` }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
/* Post-submission: time between steps, and universities sitting on applications */
function PostSub({ apps, s, now, n, open }: { apps: RepApp[]; s: InsightSettings; now: number; n: N; open: (t: string, a: RepApp[]) => void }) {
  const M = (k: string) => msOf(s, k);
  const sub = M('submitted'), off = M('offer');
  const lodged = apps.filter((a) => reachedAt(a, sub.status) !== undefined);
  const waiting = lodged.filter((a) => isLive(a) && reachedAt(a, off.status) === undefined);
  const late = waiting.filter((a) => daysSince(reachedAt(a, sub.status)!, now) >= s.idleDays);
  const lo = between(apps, sub.status, off.status);
  const steps = s.milestones.slice(0, -1).map((m, i) => ({ from: m, to: s.milestones[i + 1], ...between(apps, m.status, s.milestones[i + 1].status) })).filter((x) => x.n);
  const unis = [...groupBy(waiting, (a) => a.uni).entries()].map(([u, l]) => ({ u, l, late: l.filter((a) => daysSince(reachedAt(a, sub.status)!, now) >= s.idleDays), oldest: Math.max(...l.map((a) => daysSince(reachedAt(a, sub.status)!, now))) })).sort((a, b) => b.l.length - a.l.length);
  const d1 = (x: number | null) => (x === null ? '—' : `${x.toFixed(x < 10 ? 1 : 0)} d`);
  type S = (typeof steps)[number];
  const scols: Col<S>[] = [
    { h: 'Step', v: (r) => `${r.from.label} → ${r.to.label}` },
    { h: 'Applications with both dates', n: true, v: (r) => r.n.toLocaleString('en-GB') },
    { h: 'Median', n: true, v: (r) => d1(r.median) },
    { h: 'Average', n: true, v: (r) => d1(r.avg) },
    { h: '90th percentile', n: true, v: (r) => d1(r.p90) },
  ];
  type U = (typeof unis)[number];
  const ucols: Col<U>[] = [
    { h: 'University', v: (r) => uniOf(r.u) },
    { h: 'Awaiting offer', n: true, v: (r) => n(r.l, `${uniOf(r.u)}: awaiting offer`), csv: (r) => r.l.length },
    { h: `${s.idleDays}+ d`, n: true, v: (r) => n(r.late, `${uniOf(r.u)}: waiting ${s.idleDays}+ days`), csv: (r) => r.late.length },
    { h: 'Oldest', n: true, v: (r) => `${r.oldest} d` },
  ];
  return (
    <>
      <div className="ins-stats">
        <Stat title="Submitted to university" apps={lodged} sub={`${lodged.filter(isLive).length.toLocaleString('en-GB')} still live`} open={open} />
        <Stat title="Awaiting offer" apps={waiting} open={open} />
        <Stat title={`Awaiting offer ${s.idleDays}+ d`} apps={late} sub="Since lodged" open={open} />
        <Stat title="Median lodged → offer" apps={[]} count={d1(lo.median)} sub={`90th percentile ${d1(lo.p90)} · ${lo.n.toLocaleString('en-GB')} offers`} open={open} />
      </div>
      <div className="ins__grid">
        <Card title="Time between steps" sub="Every application with both dates" flush action={<CsvButton name="time-between-steps" rows={steps} cols={scols} />}>
          <Table rows={steps} cols={scols} rowKey={(r) => r.from.key} />
        </Card>
        <Card title="Universities sitting on applications" sub="Lodged, no offer yet" flush action={<CsvButton name="universities-sitting" rows={unis} cols={ucols} />}>
          <Table rows={unis} cols={ucols} rowKey={(r) => r.u} />
        </Card>
      </div>
    </>
  );
}

/* Offers: conditional and unconditional, by a dimension */
type Dim = 'dest' | 'uni' | 'region' | 'bdm';
const DIMS: [Dim, string][] = [['dest', 'By destination'], ['uni', 'By university'], ['region', 'By sales region'], ['bdm', 'By application BDM']];
const dimOf = (k: Dim) => (a: RepApp) => (k === 'uni' ? uniOf(a.uni) : a[k]);
function Offers({ apps, s, n, open }: { apps: RepApp[]; s: InsightSettings; n: N; open: (t: string, a: RepApp[]) => void }) {
  const [dim, setDim] = useState<Dim>('dest');
  const all = convRow(apps, s);
  // closed at any point after it was submitted (declined, withdrawn, rejected …)
  const declined = (l: RepApp[]) => l.filter((a) => a.end && reachedAt(a, msOf(s, 'submitted').status) !== undefined);
  const rows = [...groupBy(apps, dimOf(dim)).entries()].map(([k, l]) => ({ k, c: convRow(l, s), dec: declined(l) })).sort((a, b) => b.c.apps.length - a.c.apps.length);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: DIMS.find((x) => x[0] === dim)![1].replace('By ', ''), v: (r) => r.k },
    { h: 'Applications', n: true, v: (r) => n(r.c.apps, `${r.k}: applications`), csv: (r) => r.c.apps.length },
    { h: 'Submitted', n: true, v: (r) => n(r.c.submitted, `${r.k}: submitted`), csv: (r) => r.c.submitted.length },
    { h: 'App → sub', n: true, v: (r) => pct(rate(r.c.submitted.length, r.c.apps.length)) },
    { h: 'Offers', n: true, v: (r) => n(r.c.offers, `${r.k}: offers`), csv: (r) => r.c.offers.length },
    { h: 'Sub → offer', n: true, v: (r) => pct(rate(r.c.offers.length, r.c.submitted.length)) },
    { h: 'Unconditional', n: true, v: (r) => n(r.c.uncond, `${r.k}: unconditional`), csv: (r) => r.c.uncond.length },
    { h: 'Offer → uncond.', n: true, v: (r) => pct(rate(r.c.uncond.length, r.c.offers.length)) },
    { h: 'App → offer', n: true, v: (r) => pct(rate(r.c.offers.length, r.c.apps.length)) },
    { h: 'Closed after submission', n: true, v: (r) => n(r.dec, `${r.k}: closed after submission`), csv: (r) => r.dec.length },
  ];
  return (
    <>
      <div className="ins-stats">
        <Stat title="Application → submission" apps={all.submitted} count={pct(rate(all.submitted.length, all.apps.length))} sub={`${all.submitted.length.toLocaleString('en-GB')} of ${all.apps.length.toLocaleString('en-GB')}`} open={open} />
        <Stat title="Submission → offer" apps={all.offers} count={pct(rate(all.offers.length, all.submitted.length))} sub={`${all.offers.length.toLocaleString('en-GB')} of ${all.submitted.length.toLocaleString('en-GB')}`} open={open} />
        <Stat title="Offer → unconditional" apps={all.uncond} count={pct(rate(all.uncond.length, all.offers.length))} sub={`${all.uncond.length.toLocaleString('en-GB')} of ${all.offers.length.toLocaleString('en-GB')}`} open={open} />
        <Stat title="Application → offer" apps={all.offers} count={pct(rate(all.offers.length, all.apps.length))} sub="Conditional and unconditional" open={open} />
      </div>
      <Card title="Offer conversion" sub="An unconditional offer counts every later stage too" flush action={<span className="ins-acts"><Seg label="Group by" value={dim} items={DIMS} onPick={setDim} /><CsvButton name="offer-conversion" rows={rows} cols={cols} /></span>}>
        <Table rows={rows} cols={cols} rowKey={(r) => r.k} />
      </Card>
    </>
  );
}

/* CAS / I-20 / CoE by destination: the document each destination issues */
function EnrolDocs({ apps, s, now, n, open }: { apps: RepApp[]; s: InsightSettings; now: number; n: N; open: (t: string, a: RepApp[]) => void }) {
  const doc = msOf(s, 'enroldoc'), off = msOf(s, 'offer'), dep = msOf(s, 'deposit');
  const all = convRow(apps, s);
  const notYet = all.offers.filter((a) => isLive(a) && reachedAt(a, doc.status) === undefined);
  const depNo = all.deposits.filter((a) => isLive(a) && reachedAt(a, doc.status) === undefined);
  const rows = [...groupBy(apps, (a) => a.dest).entries()].map(([k, l]) => {
    const c = convRow(l, s);
    const nr = c.offers.filter((a) => isLive(a) && reachedAt(a, doc.status) === undefined);
    return { k, doc: ENROL_DOC[l[0].dest], c, nr, late: nr.filter((a) => daysSince(reachedAt(a, off.status)!, now) >= s.idleDays), med: between(l, off.status, doc.status).median };
  }).sort((a, b) => b.c.offers.length - a.c.offers.length);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: 'Destination', v: (r) => r.k },
    { h: 'Document', v: (r) => r.doc },
    { h: 'Offers', n: true, v: (r) => n(r.c.offers, `${r.k}: offers`), csv: (r) => r.c.offers.length },
    { h: 'Unconditional', n: true, v: (r) => n(r.c.uncond, `${r.k}: unconditional`), csv: (r) => r.c.uncond.length },
    { h: 'Deposits', n: true, v: (r) => n(r.c.deposits, `${r.k}: deposits`), csv: (r) => r.c.deposits.length },
    { h: 'Issued', n: true, v: (r) => n(r.c.enroldoc, `${r.k}: ${r.doc} issued`), csv: (r) => r.c.enroldoc.length },
    { h: 'Offer → issued', n: true, v: (r) => pct(rate(r.c.enroldoc.length, r.c.offers.length)) },
    { h: 'Not received', n: true, v: (r) => n(r.nr, `${r.k}: offer, ${r.doc} not received`), csv: (r) => r.nr.length },
    { h: `of which ${s.idleDays}+ d`, n: true, v: (r) => n(r.late, `${r.k}: ${s.idleDays}+ days`), csv: (r) => r.late.length },
    { h: 'Median offer → issued', n: true, v: (r) => (r.med === null ? '—' : `${Math.round(r.med)} d`) },
  ];
  return (
    <>
      <div className="ins-stats">
        <Stat title="Offers" apps={all.offers} sub="Conditional and unconditional" open={open} />
        <Stat title={doc.label} apps={all.enroldoc} sub={`${pct(rate(all.enroldoc.length, all.offers.length))} of offers`} open={open} />
        <Stat title="Offer, document not received" apps={notYet} sub="Live offers without it" open={open} />
        <Stat title="Deposited, document pending" apps={depNo} sub="Deposit paid, not issued" open={open} />
      </div>
      <Card title="By destination" sub="Each destination's document: the destination's setting · issued = this stage or later" flush action={<CsvButton name="enrolment-documents" rows={rows} cols={cols} />}>
        <Table rows={rows} cols={cols} rowKey={(r) => r.k} />
      </Card>
      <p className="ins-note">{`A deposit is "${dep.label}" reached.`}</p>
    </>
  );
}

/* Deposit → visa: where deposited students are, and who to chase */
function Visa({ apps, s, now, n, open, d }: { apps: RepApp[]; s: InsightSettings; now: number; n: N; open: (t: string, a: RepApp[]) => void; d: Reporting }) {
  const M = (k: string) => msOf(s, k);
  const dep = apps.filter((a) => reachedAt(a, M('deposit').status) !== undefined);
  const at = (a: RepApp, k: string) => reachedAt(a, M(k).status) !== undefined;
  const buckets = (l: RepApp[]) => ({
    awaitDoc: l.filter((a) => isLive(a) && !at(a, 'enroldoc')),
    docNoVisa: l.filter((a) => isLive(a) && at(a, 'enroldoc') && !at(a, 'visalodged')),
    lodged: l.filter((a) => isLive(a) && at(a, 'visalodged') && !at(a, 'visa')),
    refused: l.filter((a) => a.end?.kind === s.visaRefused),
    gone: l.filter((a) => a.end && a.end.kind !== s.visaRefused),
    granted: l.filter((a) => at(a, 'visa')),
  });
  const b = buckets(dep);
  // Jovial, 18 Nov: each column named by the application's own statuses (Deposit → visa columns)
  const L = {
    awaitDoc: `Before ${M('enroldoc').label}`,
    docNoVisa: `${M('enroldoc').label}, before ${M('visalodged').label}`,
    lodged: M('visalodged').label,
    refused: `Closed: ${s.visaRefused}`,
    gone: 'Closed after deposit',
    granted: `${M('visa').label} or later`,
  };
  const rows = [...groupBy(dep, (a) => a.dest).entries()].map(([k, l]) => ({ k, l, b: buckets(l) })).sort((x, y) => y.l.length - x.l.length);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: 'Destination', v: (r) => r.k },
    { h: 'Deposits', n: true, v: (r) => n(r.l, `${r.k}: deposits`), csv: (r) => r.l.length },
    { h: L.awaitDoc, n: true, v: (r) => n(r.b.awaitDoc, `${r.k}: ${L.awaitDoc}`), csv: (r) => r.b.awaitDoc.length },
    { h: L.docNoVisa, n: true, v: (r) => n(r.b.docNoVisa, `${r.k}: ${L.docNoVisa}`), csv: (r) => r.b.docNoVisa.length },
    { h: L.lodged, n: true, v: (r) => n(r.b.lodged, `${r.k}: ${L.lodged}`), csv: (r) => r.b.lodged.length },
    { h: L.refused, n: true, v: (r) => n(r.b.refused, `${r.k}: ${L.refused}`), csv: (r) => r.b.refused.length },
    { h: L.gone, n: true, v: (r) => n(r.b.gone, `${r.k}: ${L.gone}`), csv: (r) => r.b.gone.length },
    { h: L.granted, n: true, v: (r) => n(r.b.granted, `${r.k}: ${L.granted}`), csv: (r) => r.b.granted.length },
  ];
  const rp = new Map(d.rps.map((x) => [x.id, x.name]));
  const chase = dep.filter((a) => isLive(a) && !at(a, 'visa')).sort((x, y) => (reachedAt(x, M('deposit').status) ?? 0) - (reachedAt(y, M('deposit').status) ?? 0));
  const ccols: Col<RepApp>[] = [
    { h: 'Application', v: (a) => <AppLink a={a} d={d} now={now} />, csv: (a) => a.id },
    { h: 'University', v: (a) => uniOf(a.uni) },
    { h: 'Destination', v: (a) => a.dest },
    { h: 'Application BDM', v: (a) => a.bdm },
    { h: 'RP', v: (a) => rp.get(a.rp) ?? '' },
    { h: 'RP counsellor', v: (a) => a.counsellor },
    { h: 'Stage', v: (a) => STAGES[stageNow(a)] },
    { h: 'Status', v: (a) => STATUS[a.moves[a.moves.length - 1].s].text(a.dest) },
    { h: 'Deposit', v: (a) => new Date(reachedAt(a, M('deposit').status)!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) },
    { h: 'Days since', n: true, v: (a) => daysSince(reachedAt(a, M('deposit').status)!, now) },
  ];
  const share = (l: RepApp[]) => `${pct(rate(l.length, dep.length), 0)} of deposits`;
  return (
    <>
      <div className="ins-stats">
        <Stat title={`${M('deposit').label} or later`} apps={dep} open={open} />
        <Stat title={L.awaitDoc} apps={b.awaitDoc} sub={share(b.awaitDoc)} open={open} />
        <Stat title={L.docNoVisa} apps={b.docNoVisa} sub={share(b.docNoVisa)} open={open} />
        <Stat title={L.lodged} apps={b.lodged} sub={share(b.lodged)} open={open} />
        <Stat title={L.refused} apps={b.refused} sub={share(b.refused)} open={open} />
        <Stat title={L.gone} apps={b.gone} sub={share(b.gone)} open={open} />
        <Stat title={L.granted} apps={b.granted} sub={share(b.granted)} open={open} />
      </div>
      <Card title="Deposit → visa by destination" flush action={<CsvButton name="deposit-to-visa" rows={rows} cols={cols} />}>
        <Table rows={rows} cols={cols} rowKey={(r) => r.k} />
      </Card>
      <Card title="Visa chasing list" sub="Deposited, no visa yet, still live · oldest first" flush action={<CsvButton name="visa-chasing" rows={chase} cols={ccols} />}>
        <Table rows={chase.slice(0, 50)} cols={ccols} rowKey={(a) => a.id} />
      </Card>
    </>
  );
}

/* Interview tracker: applications in University assessment or interview */
function Interviews({ apps, s, now, d, rejects }: { apps: RepApp[]; s: InsightSettings; now: number; d: Reporting; rejects: string[] }) {
  const here = apps.filter((a) => isLive(a) && a.moves[a.moves.length - 1].s === s.interviewStatus);
  const past = apps.filter((a) => a.moves.some((m) => m.s === s.interviewStatus));
  const passed = past.filter((a) => reachedAt(a, msOf(s, 'uncond').status) !== undefined);
  const failed = past.filter((a) => a.end && rejects.includes(a.end.kind));
  const rp = new Map(d.rps.map((x) => [x.id, x.name]));
  const since = (a: RepApp) => daysSince(a.moves.find((m) => m.s === s.interviewStatus)!.at, now);
  const cols: Col<RepApp>[] = [
    { h: 'Application', v: (a) => <AppLink a={a} d={d} now={now} />, csv: (a) => a.id },
    { h: 'University', v: (a) => uniOf(a.uni) },
    { h: 'Course', v: (a) => courseOf(a.course) },
    { h: 'Destination', v: (a) => a.dest },
    { h: 'Application BDM', v: (a) => a.bdm },
    { h: 'RP', v: (a) => rp.get(a.rp) ?? '' },
    { h: 'Officer', v: (a) => a.officer },
    { h: 'Days in interview', n: true, v: (a) => since(a) },
  ];
  const { drill, open, close } = useDrill();
  return (
    <>
      <div className="ins-stats">
        <Stat title="In assessment or interview now" apps={here} open={open} />
        <Stat title="Interviewed so far" apps={past} open={open} />
        <Stat title="Passed" apps={passed} sub={`${pct(rate(passed.length, past.length))} · unconditional offer after`} open={open} />
        <Stat title="Not passed" apps={failed} sub={pct(rate(failed.length, past.length))} open={open} />
      </div>
      <Card title="In assessment or interview" sub="Applications whose status is University assessment or interview · longest first" flush action={<CsvButton name="interview-tracker" rows={here} cols={cols} />}>
        <Table rows={[...here].sort((a, b) => since(b) - since(a))} cols={cols} rowKey={(a) => a.id} empty="No application is in assessment or interview for these filters." />
      </Card>
      <Drill open={!!drill} title={drill?.title ?? ''} apps={drill?.apps ?? []} d={d} s={s} now={now} onClose={close} />
    </>
  );
}

/* Ali's reports: rejections, deadlines, course availability, application fee waivers */
function Reports({ apps, s, now, n, courses, rejects }: { apps: RepApp[]; s: InsightSettings; now: number; n: N; courses: CourseRec[]; rejects: string[] }) {
  const [rep, setRep] = useState<'rej' | 'dead' | 'avail' | 'fee'>('rej');
  return (
    <>
      <Seg label="Report" value={rep} items={[['rej', 'Rejections'], ['dead', 'Upcoming deadlines'], ['avail', 'Course availability'], ['fee', 'Application fee waivers']]} onPick={setRep} />
      {rep === 'rej' && <Rejections apps={apps} n={n} rejects={rejects} />}
      {rep === 'dead' && <Deadlines s={s} now={now} courses={courses} />}
      {rep === 'avail' && <Availability courses={courses} now={now} />}
      {rep === 'fee' && <FeeWaivers courses={courses} />}
    </>
  );
}
function Rejections({ apps, n, rejects }: { apps: RepApp[]; n: N; rejects: string[] }) {
  const [by, setBy] = useState<'uni' | 'course'>('uni');
  const rej = apps.filter((a) => a.end && rejects.includes(a.end.kind));
  const reasons = [...new Set(rej.map((a) => a.end!.reason))].sort();
  const rows = [...groupBy(rej, (a) => (by === 'uni' ? uniOf(a.uni) : `${courseOf(a.course)} · ${uniOf(a.uni)}`)).entries()].map(([k, l]) => ({ k, l, all: apps.filter((a) => (by === 'uni' ? uniOf(a.uni) : `${courseOf(a.course)} · ${uniOf(a.uni)}`) === k) })).sort((a, b) => b.l.length - a.l.length);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: by === 'uni' ? 'University' : 'Course', v: (r) => r.k },
    { h: 'Rejected', n: true, v: (r) => n(r.l, `${r.k}: rejected`), csv: (r) => r.l.length },
    { h: 'Of applications', n: true, v: (r) => pct(rate(r.l.length, r.all.length)) },
    ...reasons.map((re): Col<R> => ({ h: re, n: true, v: (r) => n(r.l.filter((a) => a.end!.reason === re), `${r.k}: ${re}`), csv: (r) => r.l.filter((a) => a.end!.reason === re).length })),
  ];
  return (
    <Card title="Rejection analysis" sub={`Closed as ${rejects.join(', ')} (marked as a rejection in Admin › Closing reasons), by the reason picked when closing`} flush action={<span className="ins-acts"><Seg label="Group by" value={by} items={[['uni', 'By university'], ['course', 'By course']]} onPick={setBy} /><CsvButton name="rejections" rows={rows} cols={cols} /></span>}>
      <Table rows={by === 'course' ? rows.slice(0, 100) : rows} cols={cols} rowKey={(r) => r.k} />
    </Card>
  );
}
function Deadlines({ s, now, courses }: { s: InsightSettings; now: number; courses: CourseRec[] }) {
  const [within, setWithin] = useState(s.deadlineWindows[0]);
  const live = courses.filter((c) => c.status === LIVE);
  const rows = live
    .flatMap((c) => c.intakes.map((i) => ({ c, i, days: Math.ceil((new Date(`${i.deadline}T23:59:00`).getTime() - now) / 86_400_000) })))
    .filter((x) => x.days >= 0 && x.days <= within)
    .sort((a, b) => a.days - b.days);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: 'Course', v: (r) => r.c.name },
    { h: 'University', v: (r) => r.c.uni.name },
    { h: 'Destination', v: (r) => r.c.uni.country },
    { h: 'Intake', v: (r) => r.i.month },
    { h: 'Deadline', v: (r) => new Date(`${r.i.deadline}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
    { h: 'Days left', n: true, v: (r) => r.days },
  ];
  return (
    <Card title="Upcoming deadlines" sub="Live courses' intake deadlines" flush action={<span className="ins-acts"><Seg label="Within" value={String(within)} items={s.deadlineWindows.map((x) => [String(x), `${x} days`] as [string, string])} onPick={(v) => setWithin(+v)} /><CsvButton name="deadlines" rows={rows} cols={cols} /></span>}>
      <Table rows={rows.slice(0, 200)} cols={cols} rowKey={(r) => `${r.c.id}|${r.i.month}`} empty="No intake deadline in this window." />
      {rows.length > 200 && <p className="ins-note" style={{ padding: '8px 20px' }}>The first 200 of {rows.length}; the CSV has them all.</p>}
    </Card>
  );
}
function Availability({ courses, now }: { courses: CourseRec[]; now: number }) {
  const today = new Date(now).toISOString().slice(0, 10);
  const stateOf = (i: CourseRec['intakes'][number]) => (i.deadline < today ? 'closed' : i.status);
  const rows = [...new Set(courses.map((c) => c.uni.name))].map((u) => {
    const l = courses.filter((c) => c.uni.name === u);
    const ints = l.flatMap((c) => (c.status === LIVE ? c.intakes : []));
    return { u, dest: l[0].uni.country, status: Object.fromEntries([...new Set(l.map((c) => c.status))].map((k) => [k, l.filter((c) => c.status === k).length])) as Record<string, number>, open: ints.filter((i) => stateOf(i) === 'open').length, likely: ints.filter((i) => stateOf(i) === 'likely').length, closed: ints.filter((i) => stateOf(i) === 'closed').length };
  });
  const statuses = [...new Set(courses.map((c) => c.status))];
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: 'University', v: (r) => r.u },
    { h: 'Destination', v: (r) => r.dest },
    ...statuses.map((k): Col<R> => ({ h: `${k} courses`, n: true, v: (r) => (r.status[k] ?? 0).toLocaleString('en-GB') })),
    { h: 'Intakes open', n: true, v: (r) => r.open },
    { h: 'Intakes likely', n: true, v: (r) => r.likely },
    { h: 'Intakes closed', n: true, v: (r) => r.closed },
  ];
  return (
    <Card title="Course availability" sub="Courses by status, and their upcoming intakes (open, likely, or past the deadline) · Suspended needs a course status Admin doesn't have yet" flush action={<CsvButton name="course-availability" rows={rows} cols={cols} />}>
      <Table rows={rows} cols={cols} rowKey={(r) => r.u} />
    </Card>
  );
}
function FeeWaivers({ courses }: { courses: CourseRec[] }) {
  const rows = [...new Set(courses.map((c) => c.uni.name))].map((u) => {
    const l = courses.filter((c) => c.uni.name === u && c.status === LIVE);
    return { u, dest: l[0]?.uni.country ?? '', free: l.filter((c) => !c.appFee), all: l.length, fee: l.length ? Math.max(...l.map((c) => c.appFee)) : 0, cur: l[0]?.currency ?? '' };
  }).filter((r) => r.all);
  type R = (typeof rows)[number];
  const cols: Col<R>[] = [
    { h: 'University', v: (r) => r.u },
    { h: 'Destination', v: (r) => r.dest },
    { h: 'Live courses', n: true, v: (r) => r.all },
    { h: 'No application fee', n: true, v: (r) => r.free.length },
    { h: 'Highest application fee', n: true, v: (r) => (r.fee ? `${r.cur} ${r.fee.toLocaleString('en-GB')}` : '—') },
  ];
  return (
    <Card title="Application fee waivers" sub="Courses with no application fee today. A waiver (amount off, from–to dates, which countries) needs fields on the course that it doesn't have yet." flush action={<CsvButton name="application-fees" rows={rows} cols={cols} />}>
      <Table rows={rows} cols={cols} rowKey={(r) => r.u} />
    </Card>
  );
}
