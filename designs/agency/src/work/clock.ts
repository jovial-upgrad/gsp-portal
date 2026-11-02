/**
 * The work clock (slice 4 PRD). Every SLA, wait, reminder, escalation and daily job counts in one time zone, IST
 * (Asia/Kolkata, UTC+5:30, no daylight saving; S4-27), whatever the browser's own zone.
 *
 * Prototype only: a reviewer can move the clock on (My work › Prototype clock) to walk a task from created to due
 * soon to breached without waiting. Every work page, the bell and the emails-sent log read `now()`. The build has no
 * such control: its jobs run on the server's clock.
 */
import { useSyncExternalStore } from 'react';

export const IST = 'Asia/Kolkata';
const H = 36e5;
const DAY = 864e5;
/** IST is UTC+5:30 all year. */
export const IST_OFFSET = 5.5 * H;

const KEY = 'gsp-work-clock-v1';
let offset = 0;
try {
  offset = Number(localStorage.getItem(KEY) || 0) || 0;
} catch {
  offset = 0;
}
const subs = new Set<() => void>();
/** Now, on the work clock (the real time plus the prototype's move-on). */
export const now = () => Date.now() + offset;
export const clockOffset = () => offset;
export function setClockOffset(ms: number) {
  offset = Math.max(0, ms);
  try {
    localStorage.setItem(KEY, String(offset));
  } catch {
    /* storage blocked */
  }
  subs.forEach((f) => f());
}
export const subscribeClock = (f: () => void) => (subs.add(f), () => void subs.delete(f));
export const useClockOffset = () => useSyncExternalStore(subscribeClock, clockOffset);

/* ---------- IST dates ---------- */
/** "2026-11-02": the IST date of a moment. */
export const istYmd = (t: number) => new Date(t + IST_OFFSET).toISOString().slice(0, 10);
/** Midnight IST of the day a moment falls on. */
export const istDayStart = (t: number) => Math.floor((t + IST_OFFSET) / DAY) * DAY - IST_OFFSET;
/** 0 = Sunday … 6 = Saturday, in IST. */
export const istWeekday = (t: number) => new Date(t + IST_OFFSET).getUTCDay();
/** "14:30", in IST. */
export const istTime = (t: number) => new Date(t + IST_OFFSET).toISOString().slice(11, 16);
/** "Tue 3 Nov", in IST. */
export const istDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { timeZone: IST, weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
/** "3 Nov 2026, 14:30 IST". */
export const istStamp = (t: number) => `${new Date(t).toLocaleDateString('en-GB', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric' })}, ${istTime(t)} IST`;
/** The moment of a time of day ("08:30") on an IST date. */
export const istAt = (ymd: string, hm: string) => Date.parse(`${ymd}T${hm}:00+05:30`);
