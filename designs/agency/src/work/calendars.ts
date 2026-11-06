/**
 * Working calendars (slice 4 PRD, S4-25, S4-27): the calendars every SLA clock counts on, in Admin › Work › Queues,
 * SLA and escalation › Working days. Each has a name, its working days, the day's start and end, its holidays and the
 * sales regions on it. A sales region is on exactly one calendar: its `calendarId` (slice 1's Working calendar picker
 * on the sales region) when set, else the calendar that lists it here. A record with no region uses the calendar that
 * lists Global. Each calendar has its own time zone (Jovial, 6 Nov). RP Home's "working hours" read them too.
 * Kept in this browser; in the real build, the work service.
 */
import { useSyncExternalStore } from 'react';
import { CALENDARS } from './seed';
import { regionOfCountry, TEST_AGENCY } from '../data/regions';
import { salesRegionNames, live } from '../admin/data/config';
import { IST } from './clock';

/** A calendar's hours and holidays are in its own time zone (Jovial, 6 Nov): `tz` is an IANA zone, like Asia/Kolkata. */
export type Calendar = { id: string; name: string; tz: string; days: number[]; start: string; end: string; holidays: [string, string][]; regions: string[] };
export const DEFAULT_START = '09:30';
export const DEFAULT_END = '18:30';

const KEY = 'gsp-work-calendars-v3'; // v3 (6 Nov): each calendar's time zone; v2: slice 1's region names
const seed = (): Calendar[] => (CALENDARS as unknown as Calendar[]).map((c) => ({ ...c, tz: c.tz ?? IST, start: c.start ?? DEFAULT_START, end: c.end ?? DEFAULT_END, holidays: c.holidays.map(([d, n]) => [d, n] as [string, string]), regions: [...c.regions] }));
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
/**
 * When a calendar's working day starts and how long it is, in hours. A day that ends at or before its start runs past
 * midnight (Jovial, 4 Nov: Latin America works 21:30 to 07:30 IST): it belongs to the day it starts on, so
 * "Mon to Sat, 21:30 to 07:30" is six shifts, each starting on Monday to Saturday evening and ending the next morning.
 */
export const dayOf = (cal: Partial<Calendar>) => {
  const open = hoursOf(cal.start ?? DEFAULT_START, DEFAULT_START);
  const close = hoursOf(cal.end ?? DEFAULT_END, DEFAULT_END);
  const hours = close > open ? close - open : close + 24 - open;
  return { open, hours: Math.max(0.5, hours), overnight: close <= open };
};

/** The calendar a sales region picked on its own record (slice 1: `calendarId`), if it names one that exists. */
const pickedOn = (region: string) => {
  const r = (live.cfg?.()?.regions ?? []).find((x) => x.name === region) as { calendarId?: string } | undefined;
  return r?.calendarId && state.some((c) => c.id === r.calendarId) ? r.calendarId : undefined;
};
/** The id of the calendar a sales region is on: its own pick first, then the calendar that lists it. */
export function calendarIdOf(region: string): string | undefined {
  return pickedOn(region) ?? state.find((c) => c.regions.includes(region))?.id;
}
/** The sales regions on a calendar (each region on exactly one). */
export const regionsOn = (cal: Calendar, regions = salesRegionNames()) => regions.filter((r) => calendarIdOf(r) === cal.id);
/**
 * Put sales regions on a calendar (and take them off any other): the calendars' own lists, and each region's
 * `calendarId`, so slice 1's picker on the sales region shows the same.
 */
export function putRegionsOn(calId: string, regions: string[]) {
  setCalendars((x) => {
    x.forEach((c) => {
      c.regions = c.id === calId ? [...regions] : c.regions.filter((r) => !regions.includes(r));
    });
    return x;
  });
  // Admin's store imports the courses, which read these calendars: loaded when needed, not at the start
  void import('../admin/data/store')
    .then((m) => m.setAdminCfg((c) => ({ ...c, regions: c.regions.map((r) => (regions.includes(r.name) ? { ...r, calendarId: calId } : (r as { calendarId?: string }).calendarId === calId ? { ...r, calendarId: undefined } : r)) })))
    .catch(() => undefined);
}

/** The calendar a sales region (or a country) works on; no region: the one listing Global; else the first. */
export function calendarOf(where?: string): Calendar {
  const names = salesRegionNames();
  const region = !where ? regionOfCountry(TEST_AGENCY.country) : names.includes(where) || where === 'Global' ? where : regionOfCountry(where);
  const id = calendarIdOf(region);
  return state.find((c) => c.id === id) ?? state.find((c) => c.regions.includes('Global')) ?? state[0];
}

/* ---------- working hours, in each calendar's own time zone ---------- */
const H = 36e5;
const DAY = 864e5;
const fmts = new Map<string, Intl.DateTimeFormat>();
/** A time zone's offset from UTC at a moment, in ms (from the browser's time zone data). */
export function tzOffset(tz: string, t: number) {
  let f = fmts.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    } catch {
      f = new Intl.DateTimeFormat('en-US', { timeZone: IST, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    }
    fmts.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(t).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return Math.round((asUtc - Math.floor(t / 6e4) * 6e4) / 6e4) * 6e4;
}
const zoneOf = (cal: Partial<Calendar>) => cal.tz || IST;
const dayStart = (cal: Calendar, t: number) => { const o = tzOffset(zoneOf(cal), t); return Math.floor((t + o) / DAY) * DAY - o; };
const weekday = (cal: Calendar, t: number) => new Date(t + tzOffset(zoneOf(cal), t)).getUTCDay();
const ymd = (cal: Calendar, t: number) => new Date(t + tzOffset(zoneOf(cal), t)).toISOString().slice(0, 10);
/** Every time zone the browser knows, for the calendar form (the list comes from the platform, not this code). */
export const timeZones = (): string[] => { try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone'); } catch { return [IST]; } };
/** A calendar's date for a moment, YYYY-MM-DD, in its own time zone. */
export const localYmd = (cal: Calendar, t: number) => ymd(cal, t);
/** The moment a calendar's clock shows `hm` on date `day` (YYYY-MM-DD). */
export const localAt = (cal: Calendar, day: string, hm: string) => {
  const guess = Date.parse(`${day}T${hm}:00Z`);
  return guess - tzOffset(zoneOf(cal), guess - tzOffset(zoneOf(cal), guess));
};
export const isWorkingDay = (cal: Calendar, t: number) => cal.days.includes(weekday(cal, t)) && !cal.holidays.some((h) => h[0] === ymd(cal, t));
/** The moment `hours` working hours after `from`, on a calendar (its days, hours and holidays, in its time zone). */
export function addWorkingHours(cal: Calendar, from: number, hours: number) {
  let left = hours * H;
  // start a day early: an overnight day that began yesterday may still be open (and an ordinary one has closed)
  let t = dayStart(cal, from) - DAY;
  const w = dayOf(cal);
  for (let guard = 0; guard < 800; guard++) {
    const day = dayStart(cal, t);
    const open = day + w.open * H;
    const close = open + w.hours * H;
    if (isWorkingDay(cal, day + 12 * H) && Math.max(t, from) < close) {
      const start = Math.max(t, open, from);
      if (start + left <= close) return start + left;
      left -= close - start;
    }
    t = day + DAY;
  }
  return t;
}
/** Working hours between two moments (negative if b is before a). */
export function workingHoursBetween(cal: Calendar, a: number, b: number): number {
  if (b < a) return -workingHoursBetween(cal, b, a);
  const w = dayOf(cal);
  let n = 0;
  for (let day = dayStart(cal, a) - DAY; day <= b; day = dayStart(cal, day + DAY + 2 * H)) {
    if (!isWorkingDay(cal, day + 12 * H)) continue;
    const open = day + w.open * H;
    const close = open + w.hours * H;
    n += Math.max(0, Math.min(close, b) - Math.max(open, a));
  }
  return n / H;
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
  return `${daysText(c.days)}, ${clockText(c.start || DEFAULT_START)} to ${clockText(c.end || DEFAULT_END)}${dayOf(c).overnight ? ' the next day' : ''}`;
}
