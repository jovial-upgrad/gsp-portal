/**
 * GSP Admin's settings, saved and shared (Jovial, 31 Oct): the one place every role reads them from. Admin's
 * configuration pages change them; course search, applications, sign-up, routing, Finance and the logs read them.
 * Kept in this browser (in the real build, the settings service), so a reload keeps them and other tabs see them.
 */
import { useSyncExternalStore } from 'react';
import { COURSES, type Course } from '../../data/courses';
import { INTAKE_TIMES, setIntakeTimesReader, type IntakeTimes } from '../../data/courses'; // hc-courses (HC8), see the end
import { fmtMoney } from '../../data/format';
import {
  sampleBdm,
  sampleEmails,
  sampleQueues,
  sampleUsers,
  sampleDocRules,
  sampleFilters,
  sampleLists,
  sampleLiving,
  sampleVisaFees,
  sampleLog,
  samplePerms,
  sampleRates,
  sampleFxWeeks,
  fillFx,
  inrPerFrom,
  sampleRegions,
  sampleRpDocs,
  sampleRules,
  condOf,
  REGION_BDM,
  regionQueueName,
  type BdmRow,
  type DocRule,
  type EmailGroup,
  type FilterSet,
  type Living,
  type VisaFee,
  type LogEntry,
  type Perms,
  type Queue,
  type Rate,
  type FxWeek,
  type Region,
  type RouteRule,
  type RpDocRule,
  type User,
} from '../data/config';

/** Everything GSP Admin configures; each change is logged. */
export type Cfg = {
  users: User[];
  regions: Region[];
  perms: Perms;
  queues: Queue[];
  emails: EmailGroup[];
  bdm: BdmRow[];
  rates: Rate[];
  /** Each week's rates (Finance prices a line at the rate of the week it's paid). */
  fxWeeks: FxWeek[];
  living: Living[];
  /** Visa and health fees by destination (the course page's Costs). */
  visaFees: VisaFee[];
  rules: RouteRule[];
  lists: Record<string, string[]>;
  regionBdm: Record<string, string>;
  /** Each region's Admissions queue (a queue id). */
  regionQueue: Record<string, string>;
  docRules: DocRule[];
  rpDocs: RpDocRule[];
  filters: FilterSet[];
  log: LogEntry[];
};
export const sampleCfg = (): Cfg => {
  const users = sampleUsers();
  const queues = sampleQueues(users);
  return {
    users,
    regions: sampleRegions(),
    perms: samplePerms(),
    queues,
    emails: sampleEmails(users),
    bdm: sampleBdm(),
    rates: sampleRates(),
    fxWeeks: sampleFxWeeks(),
    living: sampleLiving(),
    visaFees: sampleVisaFees(),
    rules: sampleRules(),
    lists: sampleLists(),
    regionBdm: { ...REGION_BDM },
    regionQueue: Object.fromEntries(Object.keys(REGION_BDM).map((r) => [r, queues.find((q) => q.name === regionQueueName(r))?.id ?? ''])),
    docRules: sampleDocRules(),
    rpDocs: sampleRpDocs(),
    filters: sampleFilters(),
    log: sampleLog(),
  };
};


const KEY = 'gsp-admin-v4'; // v4: Jovial's sheet answers (31 Oct)
let state: Cfg | null = null;
const subs = new Set<() => void>();
function load(): Cfg {
  if (state) return state;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    state = saved && saved.users ? { ...sampleCfg(), ...saved } : sampleCfg();
  } catch {
    state = sampleCfg();
  }
  // every week carries every currency (W14): older saved settings may have weeks without one
  state = { ...state!, fxWeeks: fillFx(state!.fxWeeks, state!.rates) };
  applyCourseCosts(state!);
  return state!;
}
/** Every course's living costs and visa and health fees come from Admin's tables (Jovial, 31 Oct). */
function applyCourseCosts(c: Cfg) {
  for (const x of COURSES) {
    const country = x.uni.country;
    const l = c.living.find((y) => y.country === country);
    if (l) x.living = l.perYear;
    const fees = (c.visaFees ?? []).filter((f) => f.country === country);
    if (fees.length) x.otherFees = fees.map((f) => [`${f.label}, ${f.per === 'year' ? 'a year' : 'once'}`, f.amount]);
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: this window still has it */
  }
  subs.forEach((f) => f());
}
try {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = null;
      load();
      subs.forEach((f) => f());
    }
  });
} catch {
  /* no window */
}
/** Admin's settings now. */
export const adminCfg = (): Cfg => load();
/** Change Admin's settings (Admin's pages do this through `change`, which also logs it). */
export function setAdminCfg(fn: (c: Cfg) => Cfg) {
  state = fn(load());
  applyCourseCosts(state);
  save();
}
/** Back to the sample settings. */
export function resetAdminCfg() {
  state = sampleCfg();
  save();
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
/** For stores outside React (Finance's): called on every change. */
export const onAdminChange = (f: () => void) => subscribe(f);
/** One part of what a course costs a student: what it is, how much, and what the amount is made of. */
export type CostPart = { key: 'tuition' | 'living' | 'visa' | 'app'; label: string; v: number; basis: string };
/**
 * What a course costs one student (Jovial, 1 Nov), from its record and GSP · Admin's settings as they are now:
 * tuition for the course's duration, living costs (Admin › Living costs) and visa and health cover (Admin › Visa and
 * health fees: a yearly fee for each year, a one-off once) for the same duration, and the application fee, once.
 * A course whose length is in credits has no length in time, so it's one year of each. Admin figures in another
 * currency are converted at Admin's Currency exchange.
 */
export function courseCosts(c: Course & { durUnit?: string; durValue?: number; fullFee?: number; firstYearFee?: number }) {
  const cfg = load();
  const cur = c.currency;
  const fmt = (n: number, code = cur) => fmtMoney(Math.round(n), code);
  const conv = (v: number, from: string) => {
    if (from === cur) return v;
    const a = inrPerFrom(cfg.rates, from);
    const b = inrPerFrom(cfg.rates, cur);
    return a && b ? (v * a) / b : v;
  };
  const credits = c.durUnit === 'Credits';
  const years = credits ? 1 : Math.max(1, c.months) / 12;
  const span = credits ? '1 year' : durationText(c.months);
  const times = years === 1 ? '' : ` × ${+years.toFixed(2)} years`;
  // tuition: the full course fee as entered (or tuition a year over the course's length); for credits, one year's
  const tuition = credits ? (c.firstYearFee || c.tuition) : c.fullFee && c.fullFee > 0 ? c.fullFee : (c.tuition * c.months) / 12;
  const tuitionBasis = credits ? `${fmt(tuition)} a year` : c.fullFee && c.fullFee > 0 ? 'The full course fee, from the course record' : `${fmt(c.tuition)} a year${times}`;
  const l = cfg.living.find((y) => y.country === c.uni.country);
  const living = l ? conv(l.perYear, l.currency) * years : 0;
  const fees = (cfg.visaFees ?? []).filter((f) => f.country === c.uni.country);
  const visa = fees.reduce((n, f) => n + conv(f.amount, f.currency) * (f.per === 'year' ? years : 1), 0);
  const parts: CostPart[] = [
    { key: 'tuition', label: `Tuition fee, for ${span}`, v: Math.round(tuition), basis: tuitionBasis },
    { key: 'living', label: `Living costs, for ${span}`, v: Math.round(living), basis: l ? `${fmt(l.perYear, l.currency)} a year${times}` : `Not set for ${c.uni.country} in GSP · Admin` },
    {
      key: 'visa',
      label: `Visa and health cover, for ${span}`,
      v: Math.round(visa),
      basis: fees.length ? fees.map((f) => `${f.label}: ${fmt(f.amount, f.currency)} ${f.per === 'year' ? `a year${times}` : 'once'}`).join(' · ') : `Not set for ${c.uni.country} in GSP · Admin`,
    },
    { key: 'app', label: 'Application fee, one time', v: Math.round(c.appFee), basis: c.appFee ? 'Paid once, with the application' : 'No application fee' },
  ];
  return { parts, total: parts.reduce((n, p) => n + p.v, 0), span, credits, credit: credits ? c.durValue : undefined };
}
const durationText = (m: number) => (m % 12 === 0 ? `${m / 12} ${m === 12 ? 'year' : 'years'}` : `${m} months`);
/** A document a course asks for: its name, whether it's needed, and when (or for whom). */
export type CourseDoc = [string, 'Required' | 'Optional', string];
/** The study level as Admin's document rules name it (as data/applications.ts reads them). */
const RULE_LEVEL: Record<string, string> = { Foundation: 'Foundation', Diploma: 'Diploma', 'Bachelor’s degree': 'Undergraduate', 'Postgraduate diploma': 'Postgraduate', 'Master’s degree': 'Postgraduate', 'PhD or research': 'Doctorate' };
/**
 * The documents a course asks for (Jovial, 1 Nov), from GSP · Admin › Document configuration, read the way Add an
 * application reads them (data/applications.ts docsFor): the rules switched on for the New stage that the RP uploads,
 * where the rule's study levels and university countries take this course. A rule for students already in (or
 * outside) the destination, or with a condition of its own, says so and is optional unless it's mandatory and
 * plain. Then the English test, from the course's English rule.
 */
export function courseDocs(c: Pick<Course, 'level' | 'englishFlex'> & { uni: { country: string; name: string } }): CourseDoc[] {
  const level = RULE_LEVEL[c.level] ?? 'Postgraduate';
  const out: CourseDoc[] = [];
  const dest = c.uni.country === 'UK' || c.uni.country === 'USA' ? `the ${c.uni.country}` : c.uni.country;
  for (const r of load().docRules) {
    if (!r.on || r.stage !== 'New' || r.by !== 'RP') continue;
    const k = condOf(r);
    if (k.levels.length && !k.levels.includes(level)) continue;
    if (k.countries.length && !k.countries.includes(c.uni.country)) continue;
    if (out.some(([n]) => n === r.doc)) continue;
    const where = k.where === 'Already in the destination' ? `For students already in ${dest}` : k.where === 'Outside the destination' ? `For students outside ${dest}` : '';
    const other = k.other.trim() ? `When ${k.other.trim().charAt(0).toLowerCase()}${k.other.trim().slice(1)}` : '';
    out.push([r.doc, r.setting === 'Mandatory' && !k.other.trim() ? 'Required' : 'Optional', [where, other].filter(Boolean).join('; ') || 'With the application']);
  }
  out.push(['English test score report', c.englishFlex ? 'Optional' : 'Required', c.englishFlex ? `${c.uni.name} can take it later` : 'With the application']);
  return out;
}
/** Rupees for one unit of a currency, from Admin's Currency exchange (course search's budget in lakhs). */
export const inrPer = (code: string) => inrPerFrom(load().rates, code);
/** Admin's settings in a component, kept up to date. */
export const useAdmin = () => useSyncExternalStore(subscribe, load);
/** For the Admin portal: the same as useState, but saved and shared. */
export const useAdminCfg = () => [useAdmin(), setAdminCfg] as const;

// Admin's costs reach every course from the start
load();

/* ---------- appended (hc-courses, Jovial 1 Nov, HC8): intake timings, a course setting ---------- */

/**
 * How intakes are timed in course search, applications and the catalogue: the days an intake still shows as late
 * after its deadline (14), how close a deadline is marked as soon (21) and how close it shows a countdown and counts
 * for "Deadline within" (45). Edited in Admin › Living costs › Intake timings; kept with the other settings (a saved
 * copy from before this setting gets the defaults). data/courses.ts reads it through `setIntakeTimesReader`.
 */
export type IntakeCfg = Cfg & { intakeTimes?: IntakeTimes };
export const intakeTimesOf = (c: Cfg): IntakeTimes => ({ ...INTAKE_TIMES, ...(c as IntakeCfg).intakeTimes });
/** Sets the intake timings (for `change`, which saves and logs it). */
export const withIntakeTimes = (c: Cfg, t: IntakeTimes): Cfg => ({ ...c, intakeTimes: t }) as IntakeCfg;
setIntakeTimesReader(() => intakeTimesOf(load()));
