// @ts-nocheck -- ported from the add-on layer; to be typed with the finance API.
/**
 * Finance's store (Jovial, 31 Oct): commission terms, demo enrolments with their payment history, payout runs,
 * changes waiting for a second person, and the Finance queue's tasks. Kept in this browser. In production this
 * is the commissions service; the pages only use useStore, update and the lookups below.
 */
import { useSyncExternalStore } from 'react';
import COMM from './comm.json';
import { gspRoles } from './access';
import { getState as workState } from '../work/store';
import { STAFF, label } from '../data/staff';
import { withDatasetTerms, datasetFinanceApps, withInstitution } from './fromDataset';
import { settingsOf } from './defaults';
import { onDbChange } from '../institution/data/store';
import { adminCfg, onAdminChange } from '../admin/data/store';
import { onLiveChange } from '../data/live';

const KEY = 'gsp-finance-v5'; // v5: roles, access and queues from Admin and Work; Finance setup's defaults (1 Nov)

/* Every GSP person comes from the staff list (data/staff.ts); the RP person is the sample agency's admin. */
export const USERS = [
  ...STAFF.map((p) => ({ id: p.id, name: label(p), email: p.email, role: p.role.toLowerCase().replace(/ /g, '-'), title: p.role, regions: p.regions })).sort((a, b) => a.name.localeCompare(b.name)),
  { id: 'u-nesil', name: 'Nesil Noble', role: 'rp-admin', title: 'RP Admin', agency: 'GSP test agency', branch: 'Bengaluru head office' },
];
export const DEFAULT_PERSONA = { 'gsp-finance': 'u-suman1-verma', 'gsp-admin': 'u-jovial-lejo', 'rp-admin': 'u-nesil', 'gsp-team': 'u-suman1-verma' };
const KBS_REMITTANCE = {
  id: 'M-5021', state: 'new', mailbox: 'mb-comm', subject: 'Commission remittance – Trimester 2 2026', from: ['Kaplan Business School Finance', 'agentpayments@kbs.example'],
  received: Date.now() - 20 * 36e5, attachments: ['KBS_Remittance_T2_2026.pdf'], ai: { intent: 'commission', conf: 98, record: null, reasons: [], fields: {} },
};

/**
 * Finance's commission data: its terms (comm.json), with the applications from the one data set every module reads
 * (finance/fromDataset.ts). Today is today, so the Commission tab on an application shows the same lines as here.
 */
function commFromDataset() {
  const today = new Date().toISOString().slice(0, 10);
  // Finance setup's defaults (HC43–HC45) on the settings from the start
  const cfg = withDatasetTerms({ ...COMM.cfg, settings: settingsOf(COMM.cfg) });
  // exchange rates: GSP · Admin › Currency exchange is the one source (Jovial, 31 Oct)
  cfg.settings.fx = structuredClone(adminCfg().fxWeeks);
  cfg.settings.sandboxDate = today;
  return { today, cfg, apps: datasetFinanceApps(cfg, today), runs: COMM.runs, run: null, checks: [] };
}

function fresh() {
  return {
    users: USERS, persona: null, log: [], tasks: [], records: [],
    comm: commFromDataset(),
    mail: { emails: [KBS_REMITTANCE] },
  };
}

let state;
/** An application enrolled elsewhere (Mail, say) joins Finance's applications as soon as it does. */
function joinEnrolled() {
  if (!state) return;
  const now = datasetFinanceApps(state.comm.cfg, state.comm.today);
  const add = Object.keys(now).filter((id) => !state.comm.apps[id]);
  if (!add.length) return;
  state = { ...state, comm: { ...state.comm, apps: { ...state.comm.apps, ...Object.fromEntries(add.map((id) => [id, now[id]])) } } };
  save();
  listeners.forEach((f) => f());
}
try { state = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch { state = fresh(); }
if (!state.comm) state = fresh();
const listeners = new Set();
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ } }

/*
 * What the pages read (HC46, 1 Nov): the stored state, with GSP's roles from Admin › Permission roles and the queues
 * from Work › Queues, SLA and escalation. Finance keeps no list of either.
 */
let view = null, vkey = [];
let adminTick = 0;
function queuesNow() { try { return workState().queues; } catch { return []; } }
export function getState() {
  const q = queuesNow();
  if (view && vkey[0] === state && vkey[1] === adminTick && vkey[2] === q) return view;
  view = { ...state, roles: gspRoles(), queues: q };
  vkey = [state, adminTick, q];
  return view;
}
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
onLiveChange(joinEnrolled);
joinEnrolled();
/** Admin's rates reach Finance as soon as they're saved. */
function takeAdminFx() {
  if (!state) return;
  const fx = adminCfg().fxWeeks;
  if (JSON.stringify(fx) === JSON.stringify(state.comm.cfg.settings.fx)) return;
  state = { ...state, comm: { ...state.comm, cfg: { ...state.comm.cfg, settings: { ...state.comm.cfg.settings, fx: structuredClone(fx) } } } };
  save();
  listeners.forEach((f) => f());
}
onAdminChange(takeAdminFx);
onAdminChange(() => { adminTick += 1; view = null; listeners.forEach((f) => f()); });
takeAdminFx();
/** The Institution Team's agreement dates and territory reach Finance's terms as they change (W8). */
function takeInstitution() {
  if (!state) return;
  const cfg = withInstitution(structuredClone(state.comm.cfg));
  if (JSON.stringify(cfg.unis) === JSON.stringify(state.comm.cfg.unis)) return;
  state = { ...state, comm: { ...state.comm, cfg } };
  save();
  listeners.forEach((f) => f());
}
onDbChange(takeInstitution);
takeInstitution();
/**
 * Pay day (W13, 1 Nov): a run Finance approved is paid on its pay day, not when it's approved. Until then its lines
 * stay Approved; on the day (or the first time the portal opens after it) the RP's lines are marked paid.
 */
export function settleRuns() {
  if (!state) return;
  const today = new Date().toISOString().slice(0, 10);
  const due = (state.comm.runs || []).filter((r) => r.status === 'approved' && r.date <= today);
  if (!due.length) return;
  const next = structuredClone(state);
  for (const r of next.comm.runs.filter((x) => x.status === 'approved' && x.date <= today)) {
    for (const L of r.lines || []) { const a = next.comm.apps[L.app]; if (a) a.paidRP = { ...(a.paidRP || {}), [L.key]: Math.round((((a.paidRP || {})[L.key] || 0) + L.src) * 100) / 100 }; }
    r.status = 'paid';
    if (next.comm.run && next.comm.run.date === r.date) {
      const left = Object.fromEntries(Object.entries(next.comm.run.invoices).filter(([, i]) => i.status !== 'paying'));
      next.comm.run = Object.keys(left).length ? { ...next.comm.run, status: 'prepared', invoices: left } : null;
    }
  }
  state = next;
  save();
  listeners.forEach((f) => f());
}
settleRuns();
export function useStore(select = (s) => s) { return select(useSyncExternalStore(subscribe, getState)); }
export function update(fn, logText) {
  const next = structuredClone(state);
  fn(next);
  if (logText) next.log = [{ at: Date.now(), who: next.persona, text: logText }, ...next.log].slice(0, 200);
  state = next; save(); listeners.forEach((l) => l());
}
export function resetFinance() { state = fresh(); save(); listeners.forEach((l) => l()); }

export const userById = (s, id) => s.users.find((u) => u.id === id);
export const nameOf = (s, id) => (userById(s, id) || {}).name || '—';
export const recordById = (s, id) => s.records.find((r) => r.id === id);
export const queueById = (s, id) => s.queues.find((q) => q.id === id);
