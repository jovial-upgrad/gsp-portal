// @ts-nocheck -- ported from the add-on layer; to be typed with the finance API.
/**
 * Finance's store (Jovial, 31 Oct): commission terms, demo enrolments with their payment history, payout runs,
 * changes waiting for a second person, and the Finance queue's tasks. Kept in this browser. In production this
 * is the commissions service; the pages only use useStore, update and the lookups below.
 */
import { useSyncExternalStore } from 'react';
import COMM from './comm.json';
import { ROLES, DEFAULT_MATRIX } from './access';

const KEY = 'gsp-finance-v1';

export const USERS = [
  { id: 'u-suman', name: 'Suman', role: 'finance', title: 'Finance', regions: ['Global'] },
  { id: 'u-lav', name: 'Lav', role: 'finance', title: 'Finance', regions: ['Global'] },
  { id: 'u-jovial', name: 'Jovial', role: 'admin', title: 'Admin', regions: ['Global'] },
  { id: 'u-myleeta', name: 'Myleeta', role: 'view-only', title: 'View Only', regions: ['Global'] },
  { id: 'u-nesil', name: 'Nesil Noble', role: 'rp-admin', title: 'RP Admin', agency: 'GSP test agency', branch: 'Bengaluru head office' },
];
export const DEFAULT_PERSONA = { 'gsp-finance': 'u-suman', 'gsp-admin': 'u-jovial', 'rp-admin': 'u-nesil', 'gsp-team': 'u-suman' };
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

function fresh() {
  return {
    users: USERS, roles: ROLES, matrix: DEFAULT_MATRIX, queues: QUEUES, persona: null, log: [], tasks: [], records: [],
    comm: { today: COMM.today, cfg: COMM.cfg, apps: COMM.apps, runs: COMM.runs, run: null, checks: [] },
    mail: { emails: [KBS_REMITTANCE] },
  };
}

let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch { state = fresh(); }
if (!state.comm) state = fresh();
const listeners = new Set();
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ } }

export function getState() { return state; }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
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
