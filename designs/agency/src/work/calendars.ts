/**
 * Working days (Jovial, 1 Nov, HC31): the calendars every SLA clock counts on, editable in Work › Queues, SLA and
 * escalation › Working days. Each has a name, its working days, its hours (9:30 to 18:30 unless set), its holidays
 * and the sales regions that use it (from GSP · Admin › Sales regions). RP Home's "working hours" read them too.
 * Kept in this browser; in the real build, the work service.
 */
import { useSyncExternalStore } from 'react';
import { CALENDARS } from './seed';
import { regionOfCountry, TEST_AGENCY } from '../data/regions';
import { salesRegionNames } from '../admin/data/config';

export type Calendar = { id: string; name: string; days: number[]; start: string; end: string; holidays: [string, string][]; regions: string[] };
export const DEFAULT_START = '09:30';
export const DEFAULT_END = '18:30';

const KEY = 'gsp-work-calendars-v1';
const seed = (): Calendar[] => (CALENDARS as unknown as Calendar[]).map((c) => ({ ...c, start: c.start ?? DEFAULT_START, end: c.end ?? DEFAULT_END, holidays: c.holidays.map(([d, n]) => [d, n] as [string, string]), regions: [...c.regions] }));
let state: Calendar[];
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  state = Array.isArray(saved) && saved.length ? saved : seed();
} catch {
  state = seed();
}
const subs = new Set<() => void>();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: this window still has it */
  }
  subs.forEach((f) => f());
};
export const getCalendars = () => state;
export const subscribeCalendars = (f: () => void) => (subs.add(f), () => void subs.delete(f));
export const useCalendars = () => useSyncExternalStore(subscribeCalendars, getCalendars);
export function setCalendars(fn: (c: Calendar[]) => Calendar[]) {
  state = fn(structuredClone(state));
  save();
}
export const resetCalendars = () => {
  state = seed();
  save();
};

/** "09:30" as hours: 9.5. */
export const hoursOf = (hm: string, fallback: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || '') ?? /^(\d{1,2}):(\d{2})$/.exec(fallback)!;
  return Number(m[1]) + Number(m[2]) / 60;
};
/** When a calendar's working day starts and how long it is, in hours. */
export const dayOf = (cal: Partial<Calendar>) => {
  const open = hoursOf(cal.start ?? DEFAULT_START, DEFAULT_START);
  const close = hoursOf(cal.end ?? DEFAULT_END, DEFAULT_END);
  return { open, hours: Math.max(0.5, close - open) };
};

/** The calendar a sales region (or a country) works on: the first that lists it, else the first. */
export function calendarOf(where?: string): Calendar {
  const names = salesRegionNames();
  const region = !where ? regionOfCountry(TEST_AGENCY.country) : names.includes(where) ? where : regionOfCountry(where);
  return state.find((c) => c.regions.includes(region)) ?? state.find((c) => c.regions.includes('Global')) ?? state[0];
}

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Mon–Fri", "Sun–Thu" or "Mon, Wed, Fri": the days in the week's order, a run where they run on. */
export function daysText(days: number[]) {
  const set = new Set(days);
  if (!set.size) return 'No working days';
  if (set.size === 7) return 'Every day';
  // start the run after a day off, so Sun–Thu reads as one run
  let from = 1;
  for (let i = 0; i < 7; i++) if (!set.has((i + 6) % 7) && set.has(i)) { from = i; break; }
  const order = Array.from({ length: 7 }, (_, i) => (from + i) % 7).filter((d) => set.has(d));
  const run = order.every((d, i) => i === 0 || d === (order[i - 1] + 1) % 7);
  return run && order.length > 2 ? `${SHORT[order[0]]}–${SHORT[order[order.length - 1]]}` : order.map((d) => SHORT[d]).join(', ');
}
/** "9:30 am". */
export const clockText = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${ap}`;
};
/**
 * A region's working hours in words, for RP Home's contacts: "Mon–Fri, 9:30 am to 6:30 pm". Takes a sales region or
 * a country; without one, the signed-in agency's region.
 */
export function hoursText(region?: string) {
  const c = calendarOf(region);
  if (!c) return '';
  return `${daysText(c.days)}, ${clockText(c.start || DEFAULT_START)} to ${clockText(c.end || DEFAULT_END)}`;
}
