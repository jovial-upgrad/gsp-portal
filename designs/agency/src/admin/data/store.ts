/**
 * GSP Admin's settings, saved and shared (Jovial, 31 Oct): the one place every role reads them from. Admin's
 * configuration pages change them; course search, applications, sign-up, routing, Finance and the logs read them.
 * Kept in this browser (in the real build, the settings service), so a reload keeps them and other tabs see them.
 */
import { useSyncExternalStore } from 'react';
import { COURSES } from '../../data/courses';
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
  inrPerFrom,
  sampleRegions,
  sampleRpDocs,
  sampleRules,
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
  /** Visa and health fees by destination (the course page's Other costs). */
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


const KEY = 'gsp-admin-v3'; // v3: visa and health fees (31 Oct)
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
/** Rupees for one unit of a currency, from Admin's Currency exchange (course search's budget in lakhs). */
export const inrPer = (code: string) => inrPerFrom(load().rates, code);
/** Admin's settings in a component, kept up to date. */
export const useAdmin = () => useSyncExternalStore(subscribe, load);
/** For the Admin portal: the same as useState, but saved and shared. */
export const useAdminCfg = () => [useAdmin(), setAdminCfg] as const;

// Admin's costs reach every course from the start
load();
