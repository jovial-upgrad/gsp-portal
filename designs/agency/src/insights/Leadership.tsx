import type { FxWeek } from '../admin/data/config';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { SelectInput } from '../components/forms';
import { PageHead, downloadCsv } from '../institution/records/parts';
import type { InstitutionPartner } from '../institution/data/records';
import type { Result, Tx } from '../finance/commission/engine';
import { ACTION_FROM, groupOf } from '../finance/commission/model';
import { ctxUnis, ipName } from '../finance/commission/store';
import type { Reporting, RepApp } from './data';
import { applyFilters, expected, fyMonths, fyOf, groupBy, isLive, milestoneOf, monthText, msOf, pct, rate, reachedAt, series, stageRates, type Filters, type InsightSettings } from './metrics';
import { targetFor, QUARTERS, type TargetVersion } from './targets';
import { Card, Drill, FilterBar, Num, Seg, Table, Tabs, useDrill, type Col } from './parts';

/* ---------- a month × something table, with the financial year's quarters and total ---------- */
type Period = { key: string; label: string; months: string[] };
function periodsOf(fy: number, s: InsightSettings): Period[] {
  const ms = fyMonths(fy, s.fyStartMonth);
  const qs = QUARTERS.map(([q, mm]) => ({ key: q, label: `${q}'${String(fy - (mm[0] >= s.fyStartMonth ? 1 : 0)).slice(2)}`, months: ms.filter((m) => mm.includes(+m.slice(5))) }));
  return [...ms.map((m) => ({ key: m, label: monthText(m), months: [m] })), ...qs, { key: 'fy', label: `FY${String(fy).slice(2)}`, months: ms }];
}
export type Section = { title: string; sub?: string; head: string[]; rows: (string | number)[][]; node: ReactNode };

/** One section: rows × periods, each cell a number from the applications in it. */
function matrix(title: string, sub: string, rowName: string, keys: string[], periods: Period[], cell: (k: string, p: Period) => { text: string; apps?: RepApp[]; v?: number }, n: (l: RepApp[], t: string, text: string) => ReactNode): Section {
  const head = [rowName, ...periods.map((p) => p.label)];
  const rows = keys.map((k) => [k, ...periods.map((p) => cell(k, p).text)]);
  type R = { k: string };
  const cols: Col<R>[] = [{ h: rowName, v: (r) => r.k }, ...periods.map((p): Col<R> => ({ h: p.label, n: true, v: (r) => { const c = cell(r.k, p); return c.apps ? n(c.apps, `${r.k}, ${p.label}`, c.text) : c.text; } }))];
  return { title, sub, head, rows, node: <Table rows={keys.map((k) => ({ k }))} cols={cols} rowKey={(r) => r.k} /> };
}

/** A commission line's intake ("Feb 2027") as a month key (2027-02). */
const intakeMonth = (x: string) => {
  const d = new Date(`1 ${x}`);
  return isNaN(d.getTime()) ? x.slice(0, 7) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
type Tab = 'pack' | 'country' | 'ip';
/**
 * Leadership (round 5, 18 Nov): Lav's Leadership pack and country report, and Matt's IP views. Periods follow the
 * course start (commencement month), the financial year from the settings. "Download the pack" saves every section.
 */
export function Leadership({ d, s, f, setF, now, target, versions, res, ips, fx }: { d: Reporting; s: InsightSettings; f: Filters; setF: (f: Filters) => void; now: number; target?: TargetVersion; versions: TargetVersion[]; res: Result; ips: InstitutionPartner[]; fx: FxWeek[] }) {
  // Jovial, 18 Nov: every amount in AUD at this week's rates (Admin › Currency exchange), as the Finance tabs
  const aud = useMemo(() => audOf(fx), [fx]);
  const [tab, setTab] = useState<Tab>('pack');
  const apps = useMemo(() => applyFilters(d, f), [d, f]);
  const { drill, open, close } = useDrill();
  const n = (l: RepApp[], t: string, text?: string) => <Num apps={l} open={open} title={t}>{text}</Num>;
  return (
    <div className="ins">
      <PageHead title="Leadership" lead="The Leadership pack, a country's report and the IP team's views. Periods follow the course start, in the financial year." />
      <FilterBar d={d} f={f} set={setF} />
      <Tabs label="Leadership dashboards" value={tab} items={[['pack', 'Leadership pack'], ['country', 'Country report'], ['ip', 'IP team']]} onPick={setTab} />
      {tab === 'pack' && <Pack d={d} apps={apps} s={s} now={now} target={target} res={res} n={n} aud={aud} />}
      {tab === 'country' && <Country d={d} apps={apps} s={s} now={now} target={target} versions={versions} res={res} n={n} aud={aud} />}
      {tab === 'ip' && <IpTeam apps={apps} s={s} ips={ips} n={n} />}
      <Drill open={!!drill} title={drill?.title ?? ''} apps={drill?.apps ?? []} d={d} s={s} now={now} onClose={close} />
    </div>
  );
}
type N = (l: RepApp[], t: string, text?: string) => ReactNode;
const students = (l: RepApp[]) => new Set(l.map((a) => a.student)).size;
/** The applications whose course starts in a period. */
const inP = (l: RepApp[], p: Period) => l.filter((a) => p.months.includes(a.intake));

function Pack({ d, apps, s, now, target, res, n, aud }: { d: Reporting; apps: RepApp[]; s: InsightSettings; now: number; target?: TargetVersion; res: Result; n: N; aud: Aud }) {
  const thisFy = +fyOf(new Date(now).toISOString().slice(0, 7), s.fyStartMonth).fy.slice(2) + 2000;
  const [fy, setFy] = useState(thisFy);
  const P = periodsOf(fy, s);
  const Q = P.filter((p) => p.months.length > 1);
  const regions = [...new Set(apps.map((a) => a.region))].sort();
  const dests = [...new Set(apps.map((a) => a.dest))].sort();
  const enr = msOf(s, 'enrolled'), visa = msOf(s, 'visa');
  const by = (k: 'region' | 'dest', v: string) => apps.filter((a) => a[k] === v);
  const enrolled = (l: RepApp[]) => l.filter((a) => reachedAt(a, enr.status) !== undefined);
  const sections: Section[] = [
    matrix('Priority IP share by sales region', `Applications to priority IPs, of all · target ${s.priorityTarget}%`, 'Sales region', regions, Q, (r, p) => {
      const l = inP(by('region', r), p);
      const y = l.filter((a) => a.priority);
      return { text: l.length ? `${pct(rate(y.length, l.length), 0)} (${y.length}/${l.length})` : '—', apps: y };
    }, n),
    matrix('Destination diversity', 'Applications by destination, share of the period', 'Destination', dests, P, (k, p) => {
      const all = inP(apps, p);
      const l = all.filter((a) => a.dest === k);
      return { text: l.length ? `${l.length} · ${pct(rate(l.length, all.length), 0)}` : '—', apps: l };
    }, n),
    matrix('Destination targets', `Enrolments against the ${target?.name ?? 'current'} targets (Destination level)`, 'Destination', dests, Q, (k, p) => {
      const l = enrolled(inP(by('dest', k), p));
      const t = targetFor(target, 'Destination', k, 'enrolled', p.months);
      return { text: `${l.length}${t !== null ? ` / ${t}` : ''}`, apps: l };
    }, n),
    rpCos(res, regions, P, s, aud),
    matrix('App to enrolment conversion by sales region', 'Unique students: enrolled ÷ applied', 'Sales region', regions, P, (r, p) => {
      const l = inP(by('region', r), p);
      const e = enrolled(l);
      return { text: l.length ? pct(rate(students(e), students(l))) : '—', apps: e };
    }, n),
    matrix('BDM performance', 'Unique student applications · enrolments', 'BDM', [...new Set(apps.map((a) => a.bdm))].sort(), Q, (b, p) => {
      const l = inP(apps.filter((a) => a.bdm === b), p);
      return { text: `${students(l)} · ${students(enrolled(l))}`, apps: l };
    }, n),
    matrix('BDM target vs actual', `Enrolments against the ${target?.name ?? 'current'} targets`, 'BDM', [...new Set(apps.map((a) => a.bdm))].sort(), Q, (b, p) => {
      const e = enrolled(inP(apps.filter((a) => a.bdm === b), p));
      const t = targetFor(target, 'BDM', b, 'enrolled', p.months);
      return { text: `${e.length}${t !== null ? ` / ${t}` : ''}`, apps: e };
    }, n),
    matrix('Visa pass rate by sales region', 'Granted ÷ (granted + refused)', 'Sales region', regions, P, (r, p) => {
      const l = inP(by('region', r), p);
      const g = l.filter((a) => reachedAt(a, visa.status) !== undefined);
      const x = l.filter((a) => a.end?.kind === s.visaRefused);
      return { text: g.length + x.length ? pct(rate(g.length, g.length + x.length), 0) : '—', apps: g };
    }, n),
    matrix('Applications per student', 'Applications ÷ unique students', 'Sales region', regions, P, (r, p) => {
      const l = inP(by('region', r), p);
      return { text: l.length ? (l.length / students(l)).toFixed(2) : '—', apps: l };
    }, n),
    activeRps(d, apps, s, fy),
  ];
  const pack = () => {
    const rows: (string | number)[][] = [[`GSP Leadership pack FY${String(fy).slice(2)}`], [`Saved ${new Date(now).toISOString().slice(0, 10)}`]];
    sections.forEach((x) => rows.push([], [x.title], ...(x.sub ? [[x.sub]] : []), x.head, ...x.rows));
    downloadCsv(`leadership-pack-fy${String(fy).slice(2)}.csv`, rows);
  };
  return (
    <>
      <div className="ins-acts">
        <Seg label="Financial year" value={String(fy)} items={[thisFy - 1, thisFy, thisFy + 1].map((y) => [String(y), `FY${String(y).slice(2)}`] as [string, string])} onPick={(v) => setFy(+v)} />
        <Button onClick={pack}>Download the pack</Button>
      </div>
      {sections.map((x) => (
        <Card key={x.title} title={x.title} sub={x.sub} flush>
          {x.node}
        </Card>
      ))}
    </>
  );
}
/** RP COS % by sales region and course start: what RPs earn ÷ what GSP earns, from the commission lines that count. */
function rpCos(res: Result, regions: string[], P: Period[], s: InsightSettings, aud: Aud): Section {
  const lines = res.txs.filter((t) => groupOf(t.side, t.status) !== 'none');
  const month = (t: Tx) => intakeMonth(t.intake);
  const cell = (r: string, p: Period) => {
    const l = lines.filter((t) => t.region === r && p.months.includes(month(t)));
    const uni = l.filter((t) => t.side === 'uni').reduce((a, t) => a + aud(t.amount, t.currency), 0);
    const rp = l.filter((t) => t.side === 'rp').reduce((a, t) => a + aud(t.amount, t.currency), 0);
    return uni ? pct(rp / uni, 0) : '—';
  };
  const head = ['Sales region', ...P.map((p) => p.label)];
  const rows = regions.map((r) => [r, ...P.map((p) => cell(r, p))]);
  type R = { r: string };
  const cols: Col<R>[] = [{ h: 'Sales region', v: (x) => x.r }, ...P.map((p): Col<R> => ({ h: p.label, n: true, v: (x) => cell(x.r, p) }))];
  void s;
  return { title: 'RP COS % by sales region', sub: 'Lifetime RP commission ÷ GSP commission on the enrolments starting in the period (commission lines)', head, rows, node: <Table rows={regions.map((r) => ({ r }))} cols={cols} rowKey={(x) => x.r} /> };
}
/** Active RPs: registered RPs that sent at least one application in the financial year, and those that gave an enrolment. */
function activeRps(d: Reporting, apps: RepApp[], s: InsightSettings, fy: number): Section {
  const ms = fyMonths(fy, s.fyStartMonth);
  const start = new Date(`${ms[0]}-01T00:00:00`).getTime();
  const end = new Date(`${ms[11]}-28T23:59:00`).getTime() + 4 * 86_400_000;
  const regions = [...new Set(d.rps.map((r) => r.region))].sort();
  const enr = msOf(s, 'enrolled');
  const rows = regions.map((g) => {
    const all = d.rps.filter((r) => r.region === g);
    const act = all.filter((r) => apps.some((a) => a.rp === r.id && a.created >= start && a.created <= end));
    const gave = act.filter((r) => apps.some((a) => a.rp === r.id && reachedAt(a, enr.status) !== undefined));
    return [g, all.length, act.length, pct(rate(act.length, all.length), 0), gave.length, pct(rate(gave.length, all.length), 0)];
  });
  const head = ['Sales region', 'Registered RPs', 'Active RPs', 'Active %', 'Active with enrolments', 'With enrolments %'];
  type R = (string | number)[];
  const cols: Col<R>[] = head.map((h, i) => ({ h, n: i > 0, v: (r) => r[i] }));
  return { title: 'Active RPs', sub: 'Active: at least one application this financial year (a setting) · thresholds 80% and 50%', head, rows, node: <Table rows={rows} cols={cols} rowKey={(r) => String(r[0])} /> };
}

/* A country's report (Lav's Bangladesh FY27): app generation against targets, forecast, payables, P&L lines */
function Country({ d, apps, s, now, target, versions, res, n, aud }: { d: Reporting; apps: RepApp[]; s: InsightSettings; now: number; target?: TargetVersion; versions: TargetVersion[]; res: Result; n: N; aud: Aud }) {
  const regions = [...new Set(d.apps.map((a) => a.region))].sort();
  const [region, setRegion] = useState(regions.includes('Bangladesh') ? 'Bangladesh' : regions[0]);
  const [proj, setProj] = useState(versions.find((v) => /projection/i.test(v.name))?.id ?? '');
  const l = apps.filter((a) => a.region === region);
  const fy = +fyOf(new Date(now).toISOString().slice(0, 7), s.fyStartMonth).fy.slice(2) + 2000;
  const P = periodsOf(fy, s);
  const enr = msOf(s, 'enrolled');
  const rates = useMemo(() => stageRates(d.apps.filter((a) => a.region === region), s, now), [d, region, s, now]);
  // app generation by intake
  type G = { k: string; cells: (p: Period) => ReactNode; csv: (p: Period) => string | number };
  const gen: G[] = [
    { k: 'Target enrolment', cells: (p) => targetFor(target, 'Sales region', region, 'enrolled', p.months) ?? '—', csv: (p) => targetFor(target, 'Sales region', region, 'enrolled', p.months) ?? '' },
    { k: 'Target unique applications', cells: (p) => targetFor(target, 'Sales region', region, 'received', p.months) ?? '—', csv: (p) => targetFor(target, 'Sales region', region, 'received', p.months) ?? '' },
    { k: 'Actual unique applications', cells: (p) => n(inP(l, p), `${region}, ${p.label}`, String(students(inP(l, p)))), csv: (p) => students(inP(l, p)) },
    { k: 'Actual enrolment', cells: (p) => { const e = inP(l, p).filter((a) => reachedAt(a, enr.status) !== undefined); return n(e, `${region}, ${p.label}: enrolled`, String(students(e))); }, csv: (p) => students(inP(l, p).filter((a) => reachedAt(a, enr.status) !== undefined)) },
    { k: 'Actual conversion', cells: (p) => pct(rate(students(inP(l, p).filter((a) => reachedAt(a, enr.status) !== undefined)), students(inP(l, p)))), csv: (p) => pct(rate(students(inP(l, p).filter((a) => reachedAt(a, enr.status) !== undefined)), students(inP(l, p)))) },
  ];
  const gcols: Col<G>[] = [{ h: region, v: (r) => r.k }, ...P.map((p): Col<G> => ({ h: p.label, n: true, v: (r) => r.cells(p), csv: (r) => r.csv(p) }))];
  // the last 12 weeks by BDM
  const weeks = series(l, (a) => a.created, 'week', now, 12);
  const bdms = [...new Set(l.map((a) => a.bdm))].sort();
  type W = { b: string };
  const wcols: Col<W>[] = [{ h: 'BDM', v: (r) => r.b }, ...weeks.map((w): Col<W> => ({ h: new Date(w.at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), n: true, v: (r) => n(w.apps.filter((a) => a.bdm === r.b), `${r.b}, week of ${new Date(w.at).toLocaleDateString('en-GB')}`) }))];
  // forecast: this quarter and next, by stage
  const curQ = P.filter((p) => p.months.length === 3).find((p) => p.months.includes(new Date(now).toISOString().slice(0, 7))) ?? P[12];
  const nextQ = P.filter((p) => p.months.length === 3)[P.filter((p) => p.months.length === 3).indexOf(curQ) + 1];
  const fc = (q?: Period) => {
    if (!q) return null;
    const live = l.filter((a) => q.months.includes(a.intake) && isLive(a));
    type F = { m: string; label: string };
    const rows: F[] = s.milestones.map((m) => ({ m: m.key, label: m.label }));
    const cols: Col<F>[] = [
      { h: 'Stage', v: (r) => r.label },
      ...q.months.map((mo): Col<F> => ({ h: monthText(mo), n: true, v: (r) => n(live.filter((a) => a.intake === mo && milestoneOf(a, s.milestones).key === r.m), `${monthText(mo)}: ${r.label}`) })),
      { h: 'Conversion to enrolment', n: true, v: (r) => pct(rates.get(r.m) ?? 0) },
    ];
    const exp = expected(live, s, rates);
    const pv = versions.find((v) => v.id === proj);
    const cm = pv ? q.months.reduce((t, mo) => t + (targetFor(pv, 'Sales region', region, 'enrolled', [mo]) ?? 0), 0) || targetFor(pv, 'Sales region', region, 'enrolled', q.months) : null;
    return (
      <Card key={q.key} title={`${q.label} forecast`} sub={`Live applications starting in the quarter, by stage · expected enrolments ≈ ${exp.toFixed(1)} (each stage's conversion over the last ${s.forecastMonths} months)${cm !== null && cm !== undefined ? ` · country manager's projection ${cm}` : ''}`} flush>
        <Table rows={rows} cols={cols} rowKey={(r) => r.m} />
      </Card>
    );
  };
  // payables and P&L lines from the commission lines
  const lines = res.txs.filter((t) => t.region === region && groupOf(t.side, t.status) !== 'none');
  const toPay = res.txs.filter((t) => t.region === region && t.side === 'rp' && (ACTION_FROM.pay as readonly string[]).includes(t.status));
  type L = { k: string; f: (t: Tx) => boolean };
  const pl: L[] = [
    { k: 'Direct commission revenue', f: (t) => t.side === 'uni' && s.directTypes.includes(t.type) },
    { k: 'Bonus and additional', f: (t) => t.side === 'uni' && !s.directTypes.includes(t.type) },
    { k: 'RP commission', f: (t) => t.side === 'rp' },
  ];
  const Q = P.filter((p) => p.months.length === 3);
  const plCols: Col<L>[] = [{ h: 'Line (AUD)', v: (r) => r.k }, ...Q.map((q): Col<L> => ({ h: q.label, n: true, v: (r) => Math.round(lines.filter((t) => r.f(t) && q.months.includes(intakeMonth(t.intake))).reduce((a, t) => a + aud(t.amount, t.currency), 0)).toLocaleString('en-GB') }))];
  return (
    <>
      <div className="ins-acts">
        <span className="ins-note">Sales region</span>
        <Seg label="Sales region" value={region} items={regions.map((r) => [r, r] as [string, string])} onPick={setRegion} />
      </div>
      <Card title="App generation by intake" sub={`Targets: ${target?.name ?? 'none'} (Sales region level)`} flush>
        <Table rows={gen} cols={gcols} rowKey={(r) => r.k} />
      </Card>
      <Card title="App generation, the last 12 weeks" sub="By BDM, by the week received" flush>
        <Table rows={bdms.map((b) => ({ b }))} cols={wcols} rowKey={(r) => r.b} />
      </Card>
      <div className="ins-acts">
        <span className="ins-note">Country manager's projection from</span>
        <SelectInput id="cr-proj" aria-label="Projection version" value={proj} placeholder="No projection" allowEmpty onChange={(e) => setProj(e.target.value)}>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </SelectInput>
      </div>
      {fc(curQ)}
      {fc(nextQ)}
      <Card title="RP payables" sub={`${toPay.length} approved RP lines to pay in ${region} (Finance › RP payables has them by week)`}>
        <p className="ins-note">{toPay.length ? `${new Set(toPay.map((t) => t.rpName)).size} RPs, the oldest due ${toPay.map((t) => t.due).sort()[0]}.` : 'Nothing approved to pay.'}</p>
      </Card>
      <Card title="Quarterly P&L: the commission lines" sub="Revenue and RP cost from the portal, by course start. Marketing service income, other revenue and opex come from Xero." flush>
        <Table rows={pl} cols={plCols} rowKey={(r) => r.k} />
      </Card>
    </>
  );
}

/* Matt: per IP, applications by stage; per IP team member, IPs by status */
function IpTeam({ apps, s, ips, n }: { apps: RepApp[]; s: InsightSettings; ips: InstitutionPartner[]; n: N }) {
  const uniIp = new Map(ctxUnis().map((u) => [u.id, ipName(u.ip) || u.name]));
  const byIp = [...groupBy(apps, (a) => uniIp.get(a.uni) ?? a.uni).entries()].sort((a, b) => b[1].length - a[1].length);
  const ms = s.milestones;
  type R = { k: string; l: RepApp[] };
  const cols: Col<R>[] = [
    { h: 'Institution partner', v: (r) => r.k },
    { h: 'Applications', n: true, v: (r) => n(r.l, `${r.k}: applications`) },
    ...ms.slice(1).map((m): Col<R> => ({ h: m.label, n: true, v: (r) => n(r.l.filter((a) => milestoneOf(a, ms).key === m.key && !a.end), `${r.k}: at ${m.label}`) })),
    { h: 'Closed', n: true, v: (r) => n(r.l.filter((a) => a.end), `${r.k}: closed`) },
  ];
  const statuses = [...new Set(ips.map((p) => p.status))];
  const rms = [...new Set(ips.map((p) => p.rm))].sort();
  type T = { rm: string };
  const tcols: Col<T>[] = [{ h: 'IP team member', v: (r) => r.rm }, ...statuses.map((st): Col<T> => ({ h: st, n: true, v: (r) => ips.filter((p) => p.rm === r.rm && p.status === st).length })), { h: 'All', n: true, v: (r) => ips.filter((p) => p.rm === r.rm).length }];
  return (
    <>
      <Card title="Applications per IP, by where they are" sub="An open application counts at the furthest stage it has reached" flush>
        <Table rows={byIp.map(([k, l]) => ({ k, l }))} cols={cols} rowKey={(r) => r.k} />
      </Card>
      <Card title="IPs per IP team member, by status" sub="From each institution partner's record (relationship manager and status)" flush>
        <Table rows={rms.map((rm) => ({ rm }))} cols={tcols} rowKey={(r) => r.rm} />
      </Card>
    </>
  );
}

type Aud = (amount: number, currency: string) => number;
/** An amount in AUD at the week's rates; a currency with no rate counts as nothing and is named, never as 1:1. */
function audOf(fx: FxWeek[]): Aud {
  const rows = fx[0]?.rows ?? [];
  return (amount, cur) => (cur === 'AUD' ? amount : amount * (rows.find((r) => r.code === cur)?.aud ?? 0));
}
