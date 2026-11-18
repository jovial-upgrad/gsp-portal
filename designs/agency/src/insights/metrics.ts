/**
 * Everything the dashboards show, worked out from the reporting records (`data.ts`) and the dashboard settings: no
 * count, rate or list is stored anywhere.
 */
import { STAGES, STATUS, STATUS_ORDER, type EndKind, type StatusKey } from '../data/applications';
import type { CloseReasons } from '../admin/data/config';
import { ENROL_DOC } from '../data/applications';
import { COURSES, UNIVERSITIES, type Destination } from '../data/courses';
import { queueTree, type Queue, type Region, type User } from '../admin/data/config';
import type { RepApp, Reporting } from './data';

/* ---------- settings (seeded; Admin changes them) ---------- */
/**
 * A checkpoint the dashboards count: the status that marks it, and its name. Jovial, 18 Nov: the name is the
 * lifecycle's own: its stage's name where the checkpoint is a stage's first status (New, Offer), otherwise the status
 * exactly as the application shows it (Submitted to university, Payment proof under review …).
 */
export type Milestone = { key: string; label: string; status: StatusKey };
const stageFirst = (k: StatusKey) => STATUS_ORDER.find((x) => STATUS[x].stage === STATUS[k].stage) === k;
/** The lifecycle's name for a checkpoint's status: the stage's name when it opens its stage, else the status. */
export const lifecycleName = (k: StatusKey) => (stageFirst(k) && STATUS[k].stage !== STATUS.enrolled.stage ? STAGES[STATUS[k].stage] : STATUS[k].text(undefined as never));
const checkpoint = (key: string, status: StatusKey): Milestone => ({ key, status, label: lifecycleName(status) });
/** The lifecycle stage an application is in now (its current status's stage). */
export const stageNow = (a: RepApp) => STATUS[a.moves[a.moves.length - 1].s].stage;
/** When it entered its current lifecycle stage. */
export const stageSince = (a: RepApp) => {
  const st = stageNow(a);
  let at = a.moves[a.moves.length - 1].at;
  for (let i = a.moves.length - 1; i >= 0 && a.moves[i].s !== 'closed' && STATUS[a.moves[i].s].stage === st; i--) at = a.moves[i].at;
  return at;
};
/** The ways of closing that count as a rejection (Admin › Closing reasons). */
export const rejectionKinds = (cr: CloseReasons[]) => cr.filter((x) => x.rejection).map((x) => x.kind);
export type InsightSettings = {
  /** An application with no status change for this many days is idle. */
  idleDays: number;
  /** The age buckets' lower bounds, in days ("0–2 d", "3–5 d" …, the last open-ended). */
  ageBuckets: number[];
  /** The milestones, in order: an application has reached one once its status is that one or any later. */
  milestones: Milestone[];
  /** The idle filter's steps ("3+ days" …). */
  idleSteps: number[];
  /** The financial year starts in this month (April), its quarters named AMJ, JAS, OND, JFM. */
  fyStartMonth: number;
  /** Next financial year's targets template is offered from this month (Jovial, 18 Nov: February, for AOP planning). */
  nextFyTemplateFrom: number;
  /** Ali's deadline report: intake deadlines in the next N days. */
  deadlineWindows: number[];
  /** How a refused visa closes an application (Deposit → visa). */
  visaRefused: EndKind;
  /** The Interview tracker: applications in this status. */
  interviewStatus: StatusKey;
  /** Potential to earn: the incentive per admission (changed live on the page to try other amounts), and what an admission is. */
  incentive: { amount: number; currency: string; milestone: string };
  /** Priority IP share target (Leadership pack: 60% baseline). */
  priorityTarget: number;
  /** IP / RP analysis: the window in months, the margin per student that counts as good, and how many enrolments a year make a big RP. */
  analysisMonths: number;
  marginPerStudent: number;
  bigRpEnrolments: number;
  /** Active RPs (Jovial, 18 Nov): the RP record statuses that count as registered, working with GSP. */
  registeredStatuses: string[];
  /** Forecast: conversion from each stage to enrolment over the last N months. */
  forecastMonths: number;
  /** The RP's share of commission used for the reporting estimates (RP COS), in %, until an RP's own terms say otherwise. */
  rpShare: number;
  /** Commission line types that are direct commission; the rest are bonus and additional (IP / RP analysis, P&L). */
  directTypes: string[];
  /** Receivables ageing buckets: days past due, upper bounds (<30, 30–60 … >365). */
  arBuckets: number[];
};
export const sampleInsightSettings = (): InsightSettings => ({
  idleDays: 5,
  ageBuckets: [0, 3, 6, 11, 21, 31],
  idleSteps: [3, 5, 7, 10, 15, 30],
  milestones: [
    checkpoint('received', 'docs'),
    checkpoint('submitted', 'lodged'),
    checkpoint('offer', 'conditions'),
    checkpoint('uncond', 'uol'),
    checkpoint('deposit', 'payreview'),
    checkpoint('enroldoc', 'acceptrec'),
    checkpoint('visalodged', 'visasub'),
    checkpoint('visa', 'startdate'),
    checkpoint('enrolled', 'enrolled'),
  ],
  fyStartMonth: 4,
  nextFyTemplateFrom: 2,
  deadlineWindows: [7, 15, 30],
  interviewStatus: 'interview',
  visaRefused: 'Visa refused',
  incentive: { amount: 5000, currency: 'INR', milestone: 'enrolled' },
  priorityTarget: 60,
  analysisMonths: 12,
  marginPerStudent: 1400,
  bigRpEnrolments: 10,
  forecastMonths: 12,
  registeredStatuses: ['Activated', 'Agreement signed'],
  rpShare: 70,
  arBuckets: [30, 60, 90, 180, 365],
  directTypes: ['Course commission', 'IP commission'],
});

/* ---------- one application ---------- */
const order = (s: StatusKey) => STATUS_ORDER.indexOf(s);
/** When the application first reached a status (or any later one), if it has. */
export const reachedAt = (a: RepApp, status: StatusKey): number | undefined => a.moves.find((m) => m.s !== 'closed' && order(m.s) >= order(status))?.at;
export const isClosed = (a: RepApp) => !!a.end;
export const isEnrolled = (a: RepApp) => a.moves[a.moves.length - 1].s === 'enrolled';
export const isLive = (a: RepApp) => !isClosed(a) && !isEnrolled(a);
/** When its status last changed. */
export const lastChange = (a: RepApp) => a.moves[a.moves.length - 1].at;
/** Days since a time, whole days. */
export const daysSince = (at: number, now: number) => Math.max(0, Math.floor((now - at) / 86_400_000));
/** The furthest milestone it has reached. */
export const milestoneOf = (a: RepApp, ms: Milestone[]) => [...ms].reverse().find((m) => reachedAt(a, m.status) !== undefined) ?? ms[0];
/** The confirmation document a destination issues (CoE, CAS, I-20 …). */
export const enrolDocOf = (d: Destination) => ENROL_DOC[d];

/* ---------- filters ---------- */
export type Filters = {
  intake: string[];
  dest: string[];
  country: string[];
  region: string[];
  uni: string[];
  rm: string[];
  bdm: string[];
  rp: string[];
  state: 'all' | 'live' | 'closed';
  from: string;
  to: string;
};
export const noFilters = (): Filters => ({ intake: [], dest: [], country: [], region: [], uni: [], rm: [], bdm: [], rp: [], state: 'all', from: '', to: '' });
export const filtersOn = (f: Filters) => (Object.keys(f) as (keyof Filters)[]).filter((k) => (Array.isArray(f[k]) ? (f[k] as string[]).length > 0 : k === 'state' ? f.state !== 'all' : !!f[k])).length;

const uniName = new Map(UNIVERSITIES.map((u) => [u.id, u.name]));
export const uniOf = (id: string) => uniName.get(id) ?? id;
const courseName = new Map(COURSES.map((c) => [c.id, c.name]));
export const courseOf = (id: string) => courseName.get(id) ?? id;
/** "2027-02" → "Feb 2027". */
export const intakeText = (k: string) => new Date(`${k}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

/**
 * The regional managers: the leaders of queues that sit under a sales region's Recruitment queue (Admin › Sales regions
 * names each region's Recruitment queue; Jovial, 18 Nov: Recruitment only, no other team's sub-queues), with the people
 * under each.
 */
export function regionalManagers(queues: Queue[], users: User[], regions: Region[]) {
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? '';
  // a region's recruitment queue, and (18 Nov) every top-level queue of type Recruitment
  const recruitment = new Set([...regions.map((r) => r.recruitment).filter(Boolean), ...queues.filter((q) => q.type === 'Recruitment' && !q.parent).map((q) => q.id)]);
  const underRecruitment = (q: Queue): boolean => {
    let p = queues.find((x) => x.id === q.parent);
    for (let i = 0; p && i < 10; i++, p = queues.find((x) => x.id === p!.parent)) if (recruitment.has(p.id)) return true;
    return false;
  };
  const out = new Map<string, Set<string>>();
  queues
    .filter((q) => q.parent && underRecruitment(q))
    .forEach((q) => {
      const people = queueTree(q, queues).flatMap((x) => [x.lead, ...x.members]).map(name).filter(Boolean);
      out.set(name(q.lead), new Set([...(out.get(name(q.lead)) ?? []), ...people]));
    });
  return out;
}

/** The filter bar's options, from the records themselves. */
export function options(d: Reporting) {
  const uniq = (l: string[]) => [...new Set(l.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    intake: [...new Set(d.apps.map((a) => a.intake))].sort(),
    dest: uniq(d.apps.map((a) => a.dest)),
    country: uniq(d.apps.map((a) => a.country)),
    region: uniq(d.apps.map((a) => a.region)),
    uni: uniq(d.apps.map((a) => uniOf(a.uni))),
    rm: [...regionalManagers(d.queues, d.users, d.regions).keys()].sort(),
    bdm: uniq(d.apps.map((a) => a.bdm)),
    rp: uniq(d.rps.map((x) => x.name)),
  };
}

/** The applications the filters let through. */
export function applyFilters(d: Reporting, f: Filters) {
  const rms = regionalManagers(d.queues, d.users, d.regions);
  const underRm = f.rm.length ? new Set(f.rm.flatMap((m) => [...(rms.get(m) ?? [])])) : null;
  const rpName = new Map(d.rps.map((x) => [x.id, x.name]));
  const from = f.from ? new Date(`${f.from}T00:00:00`).getTime() : -Infinity;
  const to = f.to ? new Date(`${f.to}T23:59:59`).getTime() : Infinity;
  const has = (l: string[], v: string) => !l.length || l.includes(v);
  return d.apps.filter(
    (a) =>
      has(f.intake, a.intake) &&
      has(f.dest, a.dest) &&
      has(f.country, a.country) &&
      has(f.region, a.region) &&
      has(f.uni, uniOf(a.uni)) &&
      has(f.bdm, a.bdm) &&
      has(f.rp, rpName.get(a.rp) ?? '') &&
      (!underRm || underRm.has(a.bdm)) &&
      (f.state === 'all' || (f.state === 'live' ? isLive(a) : isClosed(a))) &&
      a.created >= from &&
      a.created <= to,
  );
}

/* ---------- counts ---------- */
/** How many applications reached each milestone, and the step rate from the one before. */
export function funnel(apps: RepApp[], ms: Milestone[]) {
  const n = ms.map((m) => apps.filter((a) => reachedAt(a, m.status) !== undefined).length);
  return ms.map((m, i) => ({ ...m, n: n[i], share: n[0] ? n[i] / n[0] : 0, step: i && n[i - 1] ? n[i] / n[i - 1] : null }));
}
/** The applications that reached a milestone (what a number opens). */
export const reached = (apps: RepApp[], m: Milestone) => apps.filter((a) => reachedAt(a, m.status) !== undefined);

/**
 * Ramish's overview (18 Nov), per student, not per application: Safe = a visa granted on any of their
 * applications; Drop = every application closed with an outcome that counts as Drop; WIP = the rest.
 */
export function studentStates(apps: RepApp[], s: InsightSettings, visa: StatusKey) {
  const by = new Map<string, RepApp[]>();
  apps.forEach((a) => by.set(a.student, [...(by.get(a.student) ?? []), a]));
  const out = { safe: [] as string[], drop: [] as string[], wip: [] as string[], deposit: [] as string[] };
  const dep = s.milestones.find((m) => m.key === 'deposit')?.status;
  by.forEach((l, id) => {
    if (dep && l.some((a) => reachedAt(a, dep) !== undefined)) out.deposit.push(id);
    if (l.some((a) => reachedAt(a, visa) !== undefined)) out.safe.push(id);
    // Jovial, 18 Nov: Drop = every one of the student's applications closed (any way)
    else if (l.every((a) => !!a.end)) out.drop.push(id);
    else out.wip.push(id);
  });
  return { students: by.size, ...out };
}

/** Live applications by their furthest milestone and the days since their status last changed. */
export function ageing(apps: RepApp[], s: InsightSettings, now: number) {
  const live = apps.filter(isLive);
  const b = s.ageBuckets;
  const bucket = (d: number) => b.reduce((k, lo, i) => (d >= lo ? i : k), 0);
  // Jovial, 18 Nov: rows are the lifecycle's stages, by each live application's current status
  const rows = STAGES.map((label, i) => ({ key: String(i), label, i }))
    .map((m) => {
      const here = live.filter((a) => stageNow(a) === m.i);
      const cells = b.map(() => [] as RepApp[]);
      here.forEach((a) => cells[bucket(daysSince(lastChange(a), now))].push(a));
      const avg = here.length ? here.reduce((t, a) => t + daysSince(lastChange(a), now), 0) / here.length : 0;
      return { m, cells, total: here, avg };
    })
    .filter((x) => x.total.length);
  const labels = b.map((lo, i) => (i === b.length - 1 ? `${lo}+ d` : `${lo}–${b[i + 1] - 1} d`));
  return { rows, labels, live };
}

export type Grain = 'day' | 'week' | 'month';
const startOf = (ms: number, g: Grain) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  if (g === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (g === 'month') d.setDate(1);
  return d.getTime();
};
const nextOf = (ms: number, g: Grain) => {
  const d = new Date(ms);
  if (g === 'day') d.setDate(d.getDate() + 1);
  else if (g === 'week') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.getTime();
};
/** Counts by day, week or month, from the first to now, with the applications behind each. */
export function series(apps: RepApp[], when: (a: RepApp) => number | undefined, g: Grain, now: number, last?: number) {
  const hits = apps.map((a) => [a, when(a)] as const).filter((x): x is readonly [RepApp, number] => x[1] !== undefined);
  if (!hits.length) return [];
  let t = startOf(Math.min(...hits.map((x) => x[1])), g);
  const out: { at: number; apps: RepApp[] }[] = [];
  const end = startOf(now, g);
  while (t <= end) {
    out.push({ at: t, apps: [] });
    t = nextOf(t, g);
  }
  hits.forEach(([a, at]) => {
    const k = startOf(at, g);
    out.find((x) => x.at === k)?.apps.push(a);
  });
  return last ? out.slice(-last) : out;
}

/** Per university: applications, offers, deposits and the application-to-offer rate. */
export function byUniversity(apps: RepApp[], s: InsightSettings) {
  const m = (k: string) => s.milestones.find((x) => x.key === k)!;
  const by = new Map<string, RepApp[]>();
  apps.forEach((a) => by.set(a.uni, [...(by.get(a.uni) ?? []), a]));
  return [...by.entries()]
    .map(([uni, l]) => {
      const offers = reached(l, m('offer'));
      const deposits = reached(l, m('deposit'));
      return { uni, name: uniOf(uni), country: l[0].dest, apps: l, offers, deposits, rate: offers.length / l.length };
    })
    .sort((a, b) => b.apps.length - a.apps.length);
}

export const pct = (x: number | null, dp = 1) => (x === null || !isFinite(x) ? '—' : `${(x * 100).toFixed(dp)}%`);


/* ---------- more ways to count (dashboards rounds 2–5) ---------- */
export const msOf = (s: InsightSettings, k: string) => s.milestones.find((m) => m.key === k)!;
export function groupBy<K>(apps: RepApp[], key: (a: RepApp) => K) {
  const m = new Map<K, RepApp[]>();
  apps.forEach((a) => m.set(key(a), [...(m.get(key(a)) ?? []), a]));
  return m;
}
/** One row of a conversion table: the applications and those that reached each milestone. */
export function convRow(apps: RepApp[], s: InsightSettings) {
  const r = (k: string) => reached(apps, msOf(s, k));
  const live = apps.filter(isLive);
  const offers = r('offer');
  return { apps, live, submitted: r('submitted'), offers, uncond: r('uncond'), deposits: r('deposit'), enroldoc: r('enroldoc'), visalodged: r('visalodged'), visa: r('visa'), enrolled: r('enrolled'), liveNoOffer: live.filter((a) => !offers.includes(a)) };
}
export const rate = (a: number, b: number) => (b ? a / b : null);
/** The financial year and quarter a course-start month falls in: "FY27", "OND". */
export function fyOf(month: string, startMonth: number) {
  const [y, m] = month.split('-').map(Number);
  const fy = m >= startMonth ? y + 1 : y;
  const names = ['JFM', 'AMJ', 'JAS', 'OND'];
  return { fy: `FY${String(fy).slice(2)}`, q: names[Math.floor((m - 1) / 3)] };
}
/** The months of a financial year, in order. */
export function fyMonths(fy: number, startMonth: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((startMonth - 1 + i) % 12) + 1;
    const y = m >= startMonth ? fy - 1 : fy;
    return `${y}-${String(m).padStart(2, '0')}`;
  });
}
export const monthText = (k: string) => new Date(`${k}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).toUpperCase().replace(' ', '-');
/** Days between two milestones for every application that reached both: median, average, 90th percentile. */
export function between(apps: RepApp[], from: StatusKey, to: StatusKey) {
  const d = apps
    .map((a) => {
      const x = reachedAt(a, from), y = reachedAt(a, to);
      return x !== undefined && y !== undefined && y >= x ? (y - x) / 86_400_000 : null;
    })
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b);
  const q = (p: number) => (d.length ? d[Math.min(d.length - 1, Math.floor(p * d.length))] : null);
  return { n: d.length, median: q(0.5), avg: d.length ? d.reduce((a, b) => a + b, 0) / d.length : null, p90: q(0.9) };
}
/**
 * Conversion to enrolment from each milestone, over applications made in the last N months whose story is over
 * (enrolled or closed): what share of those that reached the milestone enrolled.
 */
export function stageRates(apps: RepApp[], s: InsightSettings, now: number) {
  const since = now - s.forecastMonths * 30.4 * 86_400_000;
  const done = apps.filter((a) => a.created >= since && (isEnrolled(a) || isClosed(a)));
  const enr = msOf(s, 'enrolled').status;
  const out = new Map<string, number>();
  s.milestones.forEach((m) => {
    const got = done.filter((a) => reachedAt(a, m.status) !== undefined);
    out.set(m.key, got.length ? got.filter((a) => reachedAt(a, enr) !== undefined).length / got.length : 0);
  });
  return out;
}
/** Expected enrolments from live applications: each counts its stage's conversion. */
export const expected = (live: RepApp[], s: InsightSettings, rates: Map<string, number>) => live.reduce((t, a) => t + (rates.get(milestoneOf(a, s.milestones).key) ?? 0), 0);
