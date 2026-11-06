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
import { onDbChange, getDb } from '../institution/data/store';
import { registerSource } from '../work/sources';
import { compute } from './engine';
import { UNI_TERMS } from '../data/dataset';
import { agreementOf } from '../institution/data/records';
import { adminCfg, onAdminChange } from '../admin/data/store';
import { financeFxSeed } from '../admin/data/config';
import { onLiveChange } from '../data/live';

const KEY = 'gsp-finance-v7'; // v7 (6 Nov): Finance's own exchange rates, not Admin's; v6 (5 Nov): the monthly RP invoice cycle, university invoice batches, no maker-checker
// v5: roles, access and queues from Admin and Work; Finance setup's defaults (1 Nov)

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
  // exchange rates: Finance keeps its own for commissions (Jovial, 6 Nov), in Finance › Exchange rates; Admin's are for search
  cfg.settings.fx = financeFxSeed();
  cfg.settings.sandboxDate = today;
  return { today, cfg, apps: datasetFinanceApps(cfg, today), runs: COMM.runs, run: null, checks: [], rpInv: {}, uniInv: {}, queries: [], diffs: [] };
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
  // the final tuition fee changed on the application: re-price it (Jovial, 1 Nov)
  const repriced = Object.keys(now).filter((id) => state.comm.apps[id] && (state.comm.apps[id].tuition !== now[id].tuition || state.comm.apps[id].intake !== now[id].intake));
  if (!add.length && !repriced.length) return;
  state = { ...state, comm: { ...state.comm, apps: { ...state.comm.apps, ...Object.fromEntries(add.map((id) => [id, now[id]])), ...Object.fromEntries(repriced.map((id) => [id, { ...state.comm.apps[id], tuition: now[id].tuition, scholarship: 0, intake: now[id].intake, enrolled: now[id].enrolled, ...(now[id].census ? { census: now[id].census } : {}) }])) } } };
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
/*
 * What the task rules read from Finance (work/recordRules.ts: T39, T45 to T49, T60): the commission lines as the
 * engine prices them today, the changes waiting for a checker, the payout runs, the currencies the terms use, and the
 * live universities under an executed agreement that have no terms yet. Worked out once per change.
 */
let commCache = { key: null, val: null };
registerSource('commission', () => {
  const key = [state, adminTick, getDb()];
  if (commCache.key && commCache.key.every((k, i) => k === key[i])) return commCache.val;
  const c = state.comm;
  const res = compute(c.cfg, c.apps, c.today);
  const db = getDb();
  const termed = new Set(c.cfg.unis.map((u) => u.id));
  const missingTerms = db.unis.filter((u) => u.status === 'Live' && !termed.has(UNI_TERMS[u.id] ?? u.id)).map((u) => {
    const p = db.ips.find((x) => x.id === u.ip);
    const a = p && p.status === 'Agreement executed' ? agreementOf(p) : null;
    return a ? { id: u.id, name: u.name, since: Date.parse(`${a.start}T10:00:00+05:30`) } : null;
  }).filter(Boolean);
  const val = {
    checks: (c.checks || []).map((k) => ({ ...k, title: k.title || k.what || k.id })),
    lines: res.ip.map((x) => ({ uniId: x.u?.id, uniName: x.u?.name, date: x.l.date, st: x.l.st, self: !!x.u?.selfBilling })),
    exc: res.exc, runs: c.runs || [], rpInv: Object.values(c.rpInv || {}), queries: c.queries || [],
    // the RP's bell (Jovial, 5 Nov: Commissions flow Q34): ready to invoice, received, sent back, approved, paid, recovered, answered
    rpNotes: (agency) => {
      const rp = c.cfg.rps.find((r) => r.name === agency); if (!rp) return [];
      const taken = new Set(Object.values(c.rpInv || {}).filter((i) => i.status !== 'paid').flatMap((i) => i.lines.map((L) => L.app + '|' + L.key)));
      const mine = res.rp.filter((x) => (x.r.payee || x.r.rp).id === rp.id);
      const ready = mine.filter((x) => x.payable && x.due > 0 && !taken.has(x.app + '|' + x.key));
      const rec = mine.filter((x) => x.due < 0);
      const at0 = Date.parse(`${c.today}T09:00:00+05:30`);
      const out = [];
      if (ready.length) out.push({ id: `cm-ready-${c.today.slice(0, 7)}-${ready.length}`, kind: 'system', title: `${ready.length} commission line${ready.length === 1 ? ' is' : 's are'} ready to invoice`, text: 'Download this month’s invoice on Earnings, sign it and upload it.', at: at0, to: { page: 'earnings' } });
      if (rec.length) out.push({ id: `cm-rec-${rec.length}`, kind: 'system', title: 'A recovery will be taken from your next payout', text: `${rec.length} line${rec.length === 1 ? '' : 's'}: the student withdrew with a refund.`, at: at0, to: { page: 'earnings' } });
      for (const i of Object.values(c.rpInv || {}).filter((i) => i.rp === rp.id)) {
        if (i.uploadedAt) out.push({ id: `cm-inv-${i.id}-up-${i.uploadedAt}`, kind: 'system', title: `GSP received your invoice ${i.rpNo}`, text: `${i.cycleLabel}: GSP Finance is checking it.`, at: i.uploadedAt, read: true, to: { page: 'earnings' } });
        if (i.status === 'sentback') out.push({ id: `cm-inv-${i.id}-back-${i.history.length}`, kind: 'system', title: `Your invoice ${i.rpNo} was sent back`, text: `${i.reason}${i.note ? `. ${i.note}` : ''}. Upload it again on Earnings.`, at: i.history[i.history.length - 1].at, to: { page: 'earnings' } });
        if (i.checkedAt && (i.status === 'approved' || i.status === 'paid')) out.push({ id: `cm-inv-${i.id}-ok`, kind: 'system', title: `Invoice ${i.rpNo} approved`, text: `${i.cycleLabel}: paid by ${i.payBy}.`, at: i.checkedAt, to: { page: 'earnings' } });
        if (i.status === 'paid') out.push({ id: `cm-inv-${i.id}-paid`, kind: 'system', title: `Invoice ${i.rpNo} paid`, text: `Remittance: bank reference ${i.paidRef}, paid ${i.paidOn}.`, at: i.paidAt, to: { page: 'earnings' } });
      }
      for (const q of (c.queries || []).filter((q) => q.rp === rp.id && q.status === 'answered')) out.push({ id: `cm-q-${q.id}`, kind: 'system', title: `GSP answered your query on ${q.student}`, text: q.answer, at: q.answeredAt, to: { page: 'earnings' } });
      return out;
    },
    bankChanges: c.cfg.rps.filter((r) => r.bankVerified === false).map((r) => ({ id: r.id, name: r.name, at: r.bankChange?.at ?? Date.parse(`${c.today}T10:00:00+05:30`) })), currencies: [...new Set([...c.cfg.unis.map((u) => u.cur), ...c.cfg.rps.map((r) => r.cur)].filter(Boolean))], fx: c.cfg.settings.fx || [], missingTerms,
    since: Date.parse(`${c.today}T10:00:00+05:30`),
  };
  commCache = { key, val };
  return val;
});

onAdminChange(() => { adminTick += 1; view = null; listeners.forEach((f) => f()); });
/** The Institution Team's agreement dates and territory reach Finance's terms as they change (W8). */
function takeInstitution() {
  if (!state) return;
  const cfg = withInstitution(structuredClone(state.comm.cfg));
  if (JSON.stringify(cfg.unis) === JSON.stringify(state.comm.cfg.unis) && JSON.stringify(cfg.rps) === JSON.stringify(state.comm.cfg.rps)) return;
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
