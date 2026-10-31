// @ts-nocheck -- ported from the add-on layer; to be typed with the finance API.
/**
 * Finance's store (Jovial, 31 Oct): commission terms, demo enrolments with their payment history, payout runs,
 * changes waiting for a second person, and the Finance queue's tasks. Kept in this browser. In production this
 * is the commissions service; the pages only use useStore, update and the lookups below.
 */
import { useSyncExternalStore } from 'react';
import COMM from './comm.json';
import { ROLES, DEFAULT_MATRIX } from './access';
import { STAFF, label } from '../data/staff';
import { withDatasetTerms, datasetFinanceApps, fxToToday } from './fromDataset';
import { onLiveChange } from '../data/live';

const KEY = 'gsp-finance-v3'; // v3: the one data set's applications (31 Oct)

/* Every GSP person comes from the staff list (data/staff.ts); the RP person is the sample agency's admin. */
export const USERS = [
  ...STAFF.map((p) => ({ id: p.id, name: label(p), email: p.email, role: p.role.toLowerCase().replace(/ /g, '-'), title: p.role, regions: p.regions })).sort((a, b) => a.name.localeCompare(b.name)),
  { id: 'u-nesil', name: 'Nesil Noble', role: 'rp-admin', title: 'RP Admin', agency: 'GSP test agency', branch: 'Bengaluru head office' },
];
export const DEFAULT_PERSONA = { 'gsp-finance': 'u-suman1-verma', 'gsp-admin': 'u-jovial-lejo', 'rp-admin': 'u-nesil', 'gsp-team': 'u-suman1-verma' };
const QUEUES = [
  { id: 'q-finance', name: 'Finance' },
  { id: 'q-institution', name: 'Institution' },
  { id: 'q-rp-ops', name: 'Recruitment Ops' },
  { id: 'q-adm-ops', name: 'Admission Ops' },
];
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
  const cfg = fxToToday(withDatasetTerms(COMM.cfg), today);
  cfg.settings.sandboxDate = today;
  return { today, cfg, apps: datasetFinanceApps(cfg, today), runs: COMM.runs, run: null, checks: [] };
}

function fresh() {
  return {
    users: USERS, roles: ROLES, matrix: DEFAULT_MATRIX, queues: QUEUES, persona: null, log: [], tasks: [], records: [],
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

export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
onLiveChange(joinEnrolled);
joinEnrolled();
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
