// @ts-nocheck -- ported from the add-on prototype; typed when the work API is designed.
/*
 * A small store for the add-ons. It holds every list the add-on pages use,
 * saves to this browser, and tells components when something changes.
 * In the designer's codebase, replace this file with calls to his own store
 * or API; components only use `useStore`, `update` and the helpers below.
 */
import { useSyncExternalStore } from 'react';
import * as seed from './seed';
import { ROLES, DEFAULT_MATRIX } from '../finance/access';
import * as mail from './mail';

const KEY = 'gsp-work-v3'; // v3: the one data set's applications (31 Oct)

function fresh() {
  return {
    users: seed.USERS, regions: seed.REGIONS, calendars: seed.CALENDARS,
    queues: seed.QUEUES, kinds: seed.KINDS, rules: seed.RULES,
    statusSla: seed.STATUS_SLA, escalation: seed.ESCALATION,
    records: [...seed.RECORDS, ...mail.MAIL_RECORDS], tasks: [...mail.MAIL_TASKS, ...seed.TASKS], watching: seed.WATCHING,
    roles: ROLES, matrix: DEFAULT_MATRIX, persona: null, log: [],
    mail: { threads: mail.THREADS, filed: mail.FILED, mailboxes: mail.MAILBOXES, filters: mail.FILTERS, intents: mail.INTENTS, settings: mail.MAIL_SETTINGS },
  };
}

let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch { state = fresh(); }
if (!state.mail || !state.mail.threads) state = fresh();
const listeners = new Set();

function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ } }

export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function useStore(select = s => s) { return select(useSyncExternalStore(subscribe, getState)); }

/* update(draft => { ...change draft... }, 'What changed, for the log') */
export function update(fn, logText) {
  const next = structuredClone(state);
  fn(next);
  if (logText) next.log = [{ at: Date.now(), who: next.persona, text: logText }, ...next.log].slice(0, 200);
  state = next; save(); listeners.forEach(l => l());
}

export function resetAll() { state = fresh(); save(); listeners.forEach(l => l()); }

/* ---------- lookups ---------- */
export const userById = (s, id) => s.users.find(u => u.id === id);
export const nameOf = (s, id) => (userById(s, id) || {}).name || '—';
export const roleOf = (s, id) => s.roles.find(r => r.id === (userById(s, id) || {}).role);
export const recordById = (s, id) => s.records.find(r => r.id === id);
export const queueById = (s, id) => s.queues.find(q => q.id === id);
export const kindById = (s, id) => s.kinds.find(k => k.id === id);

/* ---------- SLA clock (working days) ---------- */
const DAY = 864e5;
const ymd = d => new Date(d).toISOString().slice(0, 10);

export function calendarFor(s, region) {
  return s.calendars.find(c => c.regions.includes(region || 'Global')) || s.calendars[s.calendars.length - 1];
}
function isWorkingDay(cal, d) {
  const day = new Date(d).getDay();
  return cal.days.includes(day) && !cal.holidays.some(h => h[0] === ymd(d));
}
export function addWorkingDays(cal, from, n) {
  let d = from, left = n;
  while (left > 0) { d += DAY; if (isWorkingDay(cal, d)) left -= 1; }
  return d;
}
export function workingDaysBetween(cal, a, b) {
  const sign = b >= a ? 1 : -1; let n = 0;
  for (let d = Math.min(a, b) + DAY; d <= Math.max(a, b); d += DAY) if (isWorkingDay(cal, d)) n += 1;
  return sign * n;
}

/* The SLA for a task: due date and state (on-track, due-soon, breached, done). */
export function slaOf(s, task) {
  const rec = recordById(s, task.record) || {};
  const q = queueById(s, task.queue);
  const kind = kindById(s, task.kind);
  const days = task.slaDays ?? kind?.sla ?? q?.sla ?? 2;
  const cal = calendarFor(s, rec.region || q?.region);
  const due = task.due || addWorkingDays(cal, task.created, days);
  if (task.status === 'done') return { due, days, state: 'done', text: 'Done', cal };
  const now = Date.now();
  const left = workingDaysBetween(cal, now, due);
  let state = 'on-track', text = left === 1 ? 'Due in 1 working day' : `Due in ${left} working days`;
  if (now > due) { const late = Math.max(1, workingDaysBetween(cal, due, now)); state = 'breached'; text = late === 1 ? 'Late by 1 working day' : `Late by ${late} working days`; }
  else if (left <= 0) { state = 'due-soon'; text = new Date(due).toDateString() === new Date(now).toDateString() ? 'Due today' : 'Due tomorrow'; }
  else if (left === 1 && days > 1) { state = 'due-soon'; }
  return { due, days, state, text, cal, left };
}

/* Timer on something GSP is waiting for (RP, student or university). */
export function waitOf(rec) {
  if (!rec.waitingOn || !rec.due) return null;
  const now = Date.now();
  const d = Math.round((rec.due - now) / DAY);
  if (d < 0) return { state: 'breached', text: `${-d} day${d === -1 ? '' : 's'} past due: a chase task is raised` };
  if (d <= 1) return { state: 'due-soon', text: d === 0 ? 'Due today' : 'Due tomorrow' };
  return { state: 'on-track', text: `Due in ${d} days` };
}

export const SLA_PILL = { 'on-track': ['On track', 'dpill--verified'], 'due-soon': ['Due soon', 'dpill--checking'], breached: ['Breached', 'dpill--bad'], done: ['Done', 'dpill--verified'] };
export const ASSIGN = { 'record-owner': 'Record owner', 'round-robin': 'Round robin', 'members-pick': 'Members pick', 'leader-assigns': 'Leader assigns', 'not-maker': 'Anyone but the maker', owner: 'Record owner' };
export const COVER = { leader: 'To the leader', queue: 'Back to the queue', 'round-robin': 'Round robin to others' };
