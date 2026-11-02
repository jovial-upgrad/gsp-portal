/**
 * GSP Admin's settings, saved and shared (Jovial, 31 Oct): the one place every role reads them from. Admin's
 * configuration pages change them; course search, applications, sign-up, routing, Finance and the logs read them.
 * Kept in this browser (in the real build, the settings service), so a reload keeps them and other tabs see them.
 */
import { useSyncExternalStore } from 'react';
import { COURSES, formLevelOf, type Course } from '../../data/courses';
import { INTAKE_TIMES, setIntakeTimesReader, type IntakeTimes } from '../../data/courses'; // intake timings, see the end
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
  seedQueueName,
  sampleNationality,
  SECURITY,
  sampleNationalityChanged,
  withFees,
  visaFeesOf,
  live,
  type Security,
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
  /** Admin › Sales regions: the only list of sales regions, each with its countries (HC38). */
  regions: Region[];
  /** Nationality to sales region (HC42), editable on Sales regions. */
  nationality: Record<string, string>;
  /** When each nationality row was last changed (system). */
  nationalityChanged: Record<string, number>;
  /** Each person's email preferences (Profile, S4-16): the emails they've turned off, by template id. */
  emailOff: Record<string, string[]>;
  /** Sign-in rules for every GSP portal (HC52): pre-decided, not configurable in Admin (S1C-11). Always SECURITY. */
  security: Security;
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
    nationality: sampleNationality(),
    nationalityChanged: sampleNationalityChanged(),
    emailOff: {},
    security: { ...SECURITY },
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
    // each region's Admissions queue, by the name of a queue in Admin › Work (S4-1)
    regionQueue: Object.fromEntries(Object.keys(REGION_BDM).map((r) => [r, queues.find((q) => q.name === seedQueueName(r))?.name ?? 'Global Admissions'])),
    docRules: sampleDocRules(),
    rpDocs: sampleRpDocs(),
    filters: sampleFilters(),
    log: sampleLog(),
  };
};


const KEY = 'gsp-admin-v9'; // v9 (2 Nov, lock answers S1–S2): non-EU Europe in Latin America & Europe, admin.gsp@ to the Admin queue, no Area on users, sign-in security and intake timings fixed; // v8 (2 Nov briefs): users' own regions (Global only for Admin), mailboxes per user, request categories; // v7: slices 1, 2 and 4 merged (2 Nov): a sales region's calendarId, Work's queues; v6: the slice 1 PRD's roles, region seed, matrix, login states, mailboxes, document rules, living costs and fees
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
  // permission objects added since the settings were saved start at their sample levels
  const perms = samplePerms();
  state = { ...state!, perms: { ...perms, ...state!.perms }, regions: state!.regions.map((r) => ({ ...r, countries: r.countries ?? [] })) };
  // every week carries every currency (W14): older saved settings may have weeks without one
  state = { ...state!, fxWeeks: fillFx(state!.fxWeeks, state!.rates) };
  // living costs and fees are one table (PRD slice 1): visa and health sit on each destination's row
  state = { ...state!, living: state!.living.map(withFees), nationalityChanged: state!.nationalityChanged ?? {}, emailOff: state!.emailOff ?? {} };
  // sign-in security is pre-decided (S1C-11): never a saved copy
  state = { ...state!, security: { ...SECURITY } };
  state = { ...state!, visaFees: visaFeesOf(state!.living) };
  applyCourseCosts(state!);
  return state!;
}
/** Every course's living costs and visa and health fees come from Admin › Living costs and fees. */
function applyCourseCosts(c: Cfg) {
  for (const x of COURSES) {
    const country = x.uni.country;
    const l = c.living.find((y) => y.country === country);
    if (l) {
      x.living = l.perYear;
      x.otherFees = [[`Health insurance, a year`, l.health], [`Visa fee, once`, l.visa]];
    }
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
// the readers that can't wait for the store (a nationality, a region's queue) read it once it's loaded
live.cfg = () => state;
/** Admin's settings now. */
export const adminCfg = (): Cfg => load();
/** Change Admin's settings (Admin's pages do this through `change`, which also logs it). */
export function setAdminCfg(fn: (c: Cfg) => Cfg) {
  state = fn(load());
  state = { ...state, visaFees: visaFeesOf(state.living) };
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
 * currency are converted at Admin's Currency exchange. `yearParts` are the same for the first year only (2 Nov).
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
  // the first year (Jovial, 2 Nov: the Costs tab opens with one year's costs): tuition a year, living costs a year
  // and the yearly visa and health fees, plus what's paid once (the one-off fees, the application fee), which falls
  // in the first year. A course shorter than a year is its whole length; a course in credits is already one year.
  const first = credits ? 1 : Math.min(1, years);
  const short = !credits && years < 1;
  const yearSpan = short ? span : '1 year';
  const tuitionYear = credits ? tuition : (tuition * first) / years;
  const visaYear = fees.reduce((n, f) => n + conv(f.amount, f.currency) * (f.per === 'year' ? first : 1), 0);
  const yearParts: CostPart[] = [
    { key: 'tuition', label: short ? `Tuition fee, for ${span}` : 'Tuition fee, a year', v: Math.round(tuitionYear), basis: short || credits ? tuitionBasis : c.fullFee && c.fullFee > 0 ? `The full course fee of ${fmt(tuition)} over ${span}` : `${fmt(c.tuition)} a year` },
    { key: 'living', label: short ? `Living costs, for ${span}` : 'Living costs, a year', v: Math.round(l ? conv(l.perYear, l.currency) * first : 0), basis: l ? `${fmt(l.perYear, l.currency)} a year${short ? ` × ${+first.toFixed(2)} years` : ''}, from GSP · Admin` : `Not set for ${c.uni.country} in GSP · Admin` },
    {
      key: 'visa',
      label: short ? `Visa and health cover, for ${span}` : 'Visa and health cover, first year',
      v: Math.round(visaYear),
      basis: fees.length ? fees.map((f) => `${f.label}: ${fmt(f.amount, f.currency)} ${f.per === 'year' ? 'a year' : 'once'}`).join(' · ') : `Not set for ${c.uni.country} in GSP · Admin`,
    },
    { key: 'app', label: 'Application fee, one time', v: Math.round(c.appFee), basis: c.appFee ? 'Paid once, with the application' : 'No application fee' },
  ];
  return {
    parts,
    total: parts.reduce((n, p) => n + p.v, 0),
    span,
    credits,
    credit: credits ? c.durValue : undefined,
    /** One year's costs, for the top of the Costs tab. */
    yearParts,
    yearTotal: yearParts.reduce((n, p) => n + p.v, 0),
    yearSpan,
    /** Whether the course runs longer than its first year (so the whole course's total is worth showing too). */
    longer: !credits && years > 1,
  };
}
const durationText = (m: number) => (m % 12 === 0 ? `${m / 12} ${m === 12 ? 'year' : 'years'}` : `${m} months`);
/** A document a course asks for: its name, whether it's needed, and when (or for whom). */
export type CourseDoc = [string, 'Required' | 'Optional', string];
/** The study level as Admin's document rules name it (as data/applications.ts reads them). */
// the rules name slice 2's Program levels, which are the course's own levels (PRD slice 1)
const RULE_LEVEL: Record<string, string> = { Foundation: 'Foundation', Diploma: 'Diploma', 'Bachelor’s degree': 'Bachelor’s degree', 'Postgraduate diploma': 'Postgraduate diploma', 'Master’s degree': 'Master’s degree', 'PhD or research': 'PhD or research' };
/**
 * The documents a course asks for (Jovial, 1 Nov), from GSP · Admin › Document configuration, read the way Add an
 * application reads them (data/applications.ts docsFor): the rules switched on for the New stage that the RP uploads,
 * where the rule's study levels and university countries take this course. A rule for students already in (or
 * outside) the destination, or with a condition of its own, says so and is optional unless it's mandatory and
 * plain. Then the English test, from the course's English rule.
 */
export function courseDocs(c: Pick<Course, 'level' | 'englishFlex'> & { uni: { country: string; name: string } }): CourseDoc[] {
  // a Program level Admin added counts as its Application form level (S2C-13)
  const level = RULE_LEVEL[formLevelOf(c.level)] ?? 'Postgraduate';
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

/* ---------- intake timings (hc-courses, Jovial 1 Nov, HC8; S1C-11, 2 Nov) ---------- */

/**
 * How intakes are timed in course search, applications and the catalogue: the days an intake still shows as late
 * after its deadline (14), how close a deadline is marked as soon (21) and how close it shows a countdown (45).
 * Pre-decided values, not configurable in Admin (Jovial, S1C-11): data/courses.ts INTAKE_TIMES, shown read only on
 * Admin › Living costs and fees.
 */
export const intakeTimesOf = (_c?: Cfg): IntakeTimes => ({ ...INTAKE_TIMES });
setIntakeTimesReader(() => intakeTimesOf());
