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
import { liveAll, liveFlags, onLiveChange } from '../data/live';
import { useLeave, subscribeLeave } from '../data/leave';
import { adminCfg, onAdminChange } from '../admin/data/store';
import { liveApps, appRecord, appTasks, addWorkingHours, workingHoursBetween, DAY_HOURS } from './engine';

const KEY = 'gsp-work-v4'; // v4: tasks follow the application's status (Jovial, 1 Nov)

function fresh() {
  return {
    users: seed.USERS, regions: seed.REGIONS, calendars: seed.CALENDARS,
    queues: seed.QUEUES, kinds: seed.KINDS, rules: seed.RULES,
    statusSla: seed.STATUS_SLA, escalation: seed.ESCALATION,
    records: [...seed.RECORDS, ...mail.MAIL_RECORDS], tasks: [...mail.MAIL_TASKS, ...seed.TASKS], watching: seed.WATCHING,
    roles: ROLES, matrix: DEFAULT_MATRIX, persona: null, log: [], closed: {}, overrides: {},
    mail: { threads: mail.THREADS, filed: mail.FILED, mailboxes: mail.MAILBOXES, filters: mail.FILTERS, intents: mail.INTENTS, settings: mail.MAIL_SETTINGS },
  };
}

let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch { state = fresh(); }
if (!state.mail || !state.mail.threads) state = fresh();
const listeners = new Set();

function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ } }

/**
 * What every page reads: the stored lists, plus the applications as they are now in every module and the tasks the
 * application rules create from them (work/engine.ts). Application tasks exist while their status holds: a status
 * change, forward, back or closed, closes them. A task raised by hand on an application closes when the
 * application closes (T22). Overdue tasks escalate (T51): the queue's leader at once, the team's Ops queue after 2
 * working days, Admin after 5.
 */
const SEED_RECS = Object.fromEntries(seed.RECORDS.filter(r => r.type === 'Application').map(r => [r.id, r]));
const OPS_OF = q => (!q ? 'q-fallback' : q.kind === 'region' || q.id === 'q-adm-ops' ? 'q-adm-ops' : q.id === 'q-rp-ops' ? 'q-rp-ops' : q.id === 'q-institution' || q.id === 'q-inst-ops' ? 'q-inst-ops' : q.id === 'q-finance' ? 'q-finance' : 'q-fallback');
let view = null, vkey = [];
function derive() {
  const live = liveAll(), fl = liveFlags(), minute = Math.floor(Date.now() / 60000);
  if (view && vkey[0] === state && vkey[1] === live && vkey[2] === fl && vkey[3] === leaveSnap && vkey[4] === minute) return view;
  const apps = liveApps(live);
  const recs = apps.map(a => ({ ...SEED_RECS[a.id], ...appRecord(a), ...(SEED_RECS[a.id]?.waitingOn && SEED_RECS[a.id].status === appRecord(a).status ? {} : { waitingOn: undefined }) }));
  const appIds = new Set(recs.map(r => r.id));
  const closedApp = new Set(recs.filter(r => r.closed).map(r => r.id));
  const base = { ...state, users: usersNow(state), records: [...recs, ...state.records.filter(r => r.type !== 'Application' || !appIds.has(r.id))] };
  const auto = appTasks(base, live).map(t => ({ ...t, ...(state.overrides?.[t.id] || {}) }));
  const manual = state.tasks.map(t => (t.status === 'open' && closedApp.has(t.record) ? { ...t, status: 'done', doneAt: Date.now(), doneBy: null, outcome: 'Closed with the application' } : t));
  const tasks = [...auto, ...manual].map(t => {
    if (t.status !== 'open') return t;
    const sla = slaOf(base, t);
    if (sla.state !== 'breached') return t;
    const late = workingHoursBetween(sla.cal, sla.due, Date.now());
    const q = base.queues.find(x => x.id === t.queue);
    const esc = late >= 5 * DAY_HOURS ? { level: 3, to: 'q-fallback', text: 'Escalated to Admin' } : late >= 2 * DAY_HOURS ? { level: 2, to: OPS_OF(q), text: `Escalated to ${(base.queues.find(x => x.id === OPS_OF(q)) || {}).name || 'Ops'}` } : { level: 1, to: t.queue, text: `${q ? `${nameOfIn(base, q.leader)} (leader)` : 'The leader'} told` };
    return { ...t, esc };
  });
  view = { ...base, tasks };
  vkey = [state, live, fl, leaveSnap, minute];
  return view;
}
/**
 * One user list (W17, Jovial, 1 Nov): Admin › Create roles is the source. Someone Admin creates can be given work;
 * someone deactivated can't (their open work goes to their queue's leader).
 */
const ROLE_ID = r => String(r).toLowerCase().replace(/ /g, '-');
function usersNow(st) {
  let admin = [];
  try { admin = adminCfg().users || []; } catch { admin = []; }
  const off = new Set(admin.filter(u => u.status === 'Deactivated').map(u => u.id));
  const have = new Set(st.users.map(u => u.id));
  const added = admin.filter(u => !have.has(u.id) && u.status !== 'Deactivated').map(u => ({ id: u.id, name: u.name, email: u.email, role: ROLE_ID(u.role), title: u.role, regions: u.regions || [] }));
  return [...st.users.filter(u => !off.has(u.id)), ...added];
}
let adminTick = 0;
try { onAdminChange(() => { adminTick += 1; view = null; listeners.forEach(l => l()); }); } catch { /* admin store not loaded */ }
const nameOfIn = (s, id) => (s.users.find(u => u.id === id) || {}).name || '—';
let leaveSnap = 0;
subscribeLeave(() => { leaveSnap += 1; listeners.forEach(l => l()); });
onLiveChange(() => listeners.forEach(l => l()));

export function getState() { return derive(); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Close a task by hand (one click), rule task or not. */
export function closeTask(id, by, outcome) {
  update(d => {
    const x = d.tasks.find(y => y.id === id);
    if (x) { x.status = 'done'; x.doneAt = Date.now(); x.doneBy = by; x.outcome = outcome; }
    else d.closed[id] = { at: Date.now(), by, outcome };
  }, `${nameOf(getState(), by)} completed ${id}`);
}
/** Give a task to someone (pick up, assign, hand to a teammate: Jovial, 1 Nov, A19 anyone in the team can). */
export function assignTask(id, who, by) {
  update(d => {
    const x = d.tasks.find(y => y.id === id);
    if (x) x.assignee = who;
    else d.overrides[id] = { ...(d.overrides[id] || {}), assignee: who };
  }, `${nameOf(getState(), by)} gave ${id} to ${nameOf(getState(), who)}`);
}
export function useStore(select = s => s) { return select(useSyncExternalStore(subscribe, getState)); }

/* update(draft => { ...change draft... }, 'What changed, for the log') */
export function update(fn, logText) {
  const next = structuredClone(state);
  next.closed = next.closed || {}; next.overrides = next.overrides || {};
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

/* The SLA for a task, in working hours (Jovial, 1 Nov): due time and state (on-track, due-soon, breached, done). */
const DUE_FMT = t => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
const TIME_FMT = t => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export function slaOf(s, task) {
  const rec = recordById(s, task.record) || {};
  const q = queueById(s, task.queue);
  const kind = kindById(s, task.kind);
  const hours = task.slaHours ?? (task.slaDays != null ? task.slaDays * DAY_HOURS : null) ?? kind?.sla ?? q?.sla ?? 18;
  const cal = calendarFor(s, rec.region || q?.region);
  const due = task.due || addWorkingHours(cal, task.created, hours);
  const days = hours / DAY_HOURS;
  if (task.status === 'done') return { due, days, hours, state: 'done', text: 'Done', cal };
  const now = Date.now();
  const left = workingHoursBetween(cal, now, due);
  const today = new Date(due).toDateString() === new Date(now).toDateString();
  let st = 'on-track';
  let text = today ? `Due today, ${TIME_FMT(due)}` : `Due ${DUE_FMT(due)}`;
  if (now > due) {
    const late = workingHoursBetween(cal, due, now);
    st = 'breached';
    text = late < DAY_HOURS ? `Late by ${Math.max(1, Math.round(late))} working hour${Math.round(late) === 1 ? '' : 's'}` : `Late by ${Math.floor(late / DAY_HOURS)} working day${Math.floor(late / DAY_HOURS) === 1 ? '' : 's'}`;
  } else if (left <= Math.min(DAY_HOURS, hours / 2)) st = 'due-soon';
  return { due, days, hours, state: st, text, cal, left };
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
export const ASSIGN = { 'fewest-open': 'Fewest open applications', 'record-owner': 'Record owner', 'round-robin': 'Round robin', 'members-pick': 'Members pick', 'leader-assigns': 'Leader assigns', 'not-maker': 'Anyone but the maker', owner: 'Record owner' };
export const COVER = { leader: 'To the leader', queue: 'Back to the queue', 'round-robin': 'Round robin to others' };
