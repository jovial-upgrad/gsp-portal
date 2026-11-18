/**
 * Everything the dashboards show, worked out from the reporting records (`data.ts`) and the dashboard settings: no
 * count, rate or list is stored anywhere.
 */
import { STATUS_ORDER, type EndKind, type StatusKey } from '../data/applications';
import { ENROL_DOC } from '../data/applications';
import { COURSES, UNIVERSITIES, type Destination } from '../data/courses';
import { queueTree, type Queue, type User } from '../admin/data/config';
import type { RepApp, Reporting } from './data';

/* ---------- settings (seeded; Admin changes them) ---------- */
/** A milestone the dashboards count: the status that marks it, and its name. */
export type Milestone = { key: string; label: string; status: StatusKey };
export type InsightSettings = {
  /** An application with no status change for this many days is idle. */
  idleDays: number;
  /** The age buckets' lower bounds, in days ("0–2 d", "3–5 d" …, the last open-ended). */
  ageBuckets: number[];
  /** The milestones, in order: an application has reached one once its status is that one or any later. */
  milestones: Milestone[];
  /** The closed outcomes that count as Drop (Ramish's Safe / Drop / WIP; Deferred to confirm with him). */
  dropKinds: EndKind[];
  /** The idle filter's steps ("3+ days" …). */
  idleSteps: number[];
};
export const sampleInsightSettings = (): InsightSettings => ({
  idleDays: 5,
  ageBuckets: [0, 3, 6, 11, 21, 31],
  idleSteps: [3, 5, 7, 10, 15, 30],
  milestones: [
    { key: 'received', label: 'Received', status: 'docs' },
    { key: 'submitted', label: 'Submitted', status: 'lodged' },
    { key: 'offer', label: 'Offer', status: 'conditions' },
    { key: 'uncond', label: 'Unconditional offer', status: 'uol' },
    { key: 'deposit', label: 'Deposit', status: 'payreview' },
    { key: 'enroldoc', label: 'CoE / CAS / I-20', status: 'acceptrec' },
    { key: 'visalodged', label: 'Visa lodged', status: 'visasub' },
    { key: 'visa', label: 'Visa granted', status: 'startdate' },
    { key: 'enrolled', label: 'Enrolled', status: 'enrolled' },
  ],
  dropKinds: ['Not eligible', 'Student withdrawn', 'University rejected', 'Offer declined', 'Refused after assessment', 'Rejected by university', 'Visa refused', 'Deferred'],
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

/** The regional managers: the leaders of queues that sit under another queue, with the people under each. */
export function regionalManagers(queues: Queue[], users: User[]) {
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? '';
  const out = new Map<string, Set<string>>();
  queues
    .filter((q) => q.parent)
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
    rm: [...regionalManagers(d.queues, d.users).keys()].sort(),
    bdm: uniq(d.apps.map((a) => a.bdm)),
    rp: uniq(d.rps.map((x) => x.name)),
  };
}

/** The applications the filters let through. */
export function applyFilters(d: Reporting, f: Filters) {
  const rms = regionalManagers(d.queues, d.users);
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
    else if (l.every((a) => a.end && s.dropKinds.includes(a.end.kind))) out.drop.push(id);
    else out.wip.push(id);
  });
  return { students: by.size, ...out };
}

/** Live applications by their furthest milestone and the days since their status last changed. */
export function ageing(apps: RepApp[], s: InsightSettings, now: number) {
  const live = apps.filter(isLive);
  const b = s.ageBuckets;
  const bucket = (d: number) => b.reduce((k, lo, i) => (d >= lo ? i : k), 0);
  const rows = s.milestones
    .filter((m) => m.key !== 'enrolled')
    .map((m) => {
      const here = live.filter((a) => milestoneOf(a, s.milestones).key === m.key);
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
