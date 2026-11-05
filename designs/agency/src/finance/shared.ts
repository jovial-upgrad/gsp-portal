// @ts-nocheck -- ported from the add-on layer (JS); typed properly when the finance API is designed.
/*
 * Shared helpers for the commission pages: run the engine over the store's
 * commission data, and the small vocabulary the pages share.
 */
import { useMemo } from 'react';
import { useStore, update } from './store';
import { compute, buildRun, thursdayOf, fxRate, r2, money } from './engine';
import { FIN_DEFAULTS, settingsOf, payoutCurOf } from './defaults';
export { FIN_DEFAULTS, settingsOf, payoutCurOf };

export function useComm() {
  const s = useStore();
  const res = useMemo(() => compute(s.comm.cfg, s.comm.apps, s.comm.today), [s.comm]);
  return { s, c: s.comm, cfg: s.comm.cfg, res };
}

/* The live payout run for this week's Thursday, merged with what was prepared. */
export function liveRun(c, res) {
  const day = payDayOf(c.cfg, c.today);
  // amounts at this week's rates (the invoice is made now); paid by the cycle's pay-by day (Finance setup)
  const run = buildRun(c.cfg, res, c.today);
  run.date = day;
  const saved = c.run && c.run.date === run.date ? c.run : null;
  run.status = saved ? saved.status : 'draft';
  run.preparedBy = saved?.preparedBy; run.preparedAt = saved?.preparedAt;
  run.invoices = saved?.invoices || {};
  /* RPs whose new bank details aren't verified yet are held out of the run. */
  run.bankHold = [];
  Object.values(run.payees).forEach(p => {
    const rp = c.cfg.rps.find(r => r.id === p.id);
    if (rp && rp.bankVerified === false) { run.bankHold.push(p.name); delete run.payees[p.id]; }
  });
  run.lines = run.lines.filter(L => run.payees[L.payee]);
  return run;
}

/* The engine's status colours mapped to the designer's pills. */
export const TONE = { 'p-good': 'dpill--verified', 'p-warn': 'dpill--checking', 'p-bad': 'dpill--bad', 'p-acc': '', 'p-mute': '' };

export const aud = x => (x == null ? '—' : money(x, 'AUD'));
export const sum = (list, f) => r2(list.reduce((t, x) => t + (f(x) || 0), 0));

/* Convert an amount between currencies through AUD at the week's rate. */
export function convert(cfg, amt, from, to, date) {
  if (amt == null) return null;
  const a = fxRate(cfg, from, date), b = fxRate(cfg, to, date);
  if (a == null || b == null) return null;
  return r2(amt * a / b);
}

/* Maker-checker: a change to terms waits until a different person approves it. */
export function proposeChange({ area, id, before, after, summary, impact, user }) {
  const cid = 'CHK-' + Date.now().toString(36).toUpperCase();
  update(d => {
    d.comm.checks.unshift({ id: cid, area, target: id, before, after, summary, impact, maker: user.id, at: Date.now(), status: 'waiting' });
    d.records.push({ id: 'cm-' + cid, type: 'Commission', label: 'Check · ' + summary });
    d.tasks.unshift({ id: 'T-' + cid, record: 'cm-' + cid, kind: 'k-check', queue: 'q-finance', rule: 'r13', title: 'Check: ' + summary, maker: user.id, created: Date.now(), status: 'open' });
  }, `${user.name} changed ${summary} (waiting for a checker)`);
}

export function applyChange(d, chk) {
  const cfg = d.comm.cfg;
  if (chk.area === 'settings') {
    cfg.settings = chk.after;
    // RPs paid by the region's table (no signed terms) follow it (HC44)
    (cfg.rps || []).forEach(r => { if (r.curFromTable) { const cur = (chk.after.payoutCur || FIN_DEFAULTS.payoutCur)[r.region]; r.cur = cur || 'AUD'; r.bank = cur ? 'Local' : 'AU'; } });
    return;
  }
  const list = cfg[chk.area];
  const i = list.findIndex(x => x.id === chk.target);
  if (chk.after == null) { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = chk.after; else list.push(chk.after);
}

/* What a change would do to amounts already in the system. */
export function impactOf(cfg, apps, today, area, id, after) {
  const next = structuredClone(cfg);
  applyChange({ comm: { cfg: next } }, { area, target: id, after });
  const a = compute(cfg, apps, today), b = compute(next, apps, today);
  const key = x => x.app + '|' + x.key;
  const before = Object.fromEntries(a.rp.map(x => [key(x), x.audEnt || 0]));
  let lines = 0, delta = 0;
  b.rp.forEach(x => { const d = (x.audEnt || 0) - (before[key(x)] || 0); if (Math.abs(d) > 0.005) { lines += 1; delta += d; } });
  const ipBefore = Object.fromEntries(a.ip.map(x => [x.app + '|' + x.l.key, x.l.aud || 0]));
  let ipLines = 0, ipDelta = 0;
  b.ip.forEach(x => { const d = (x.l.aud || 0) - (ipBefore[x.app + '|' + x.l.key] || 0); if (Math.abs(d) > 0.005) { ipLines += 1; ipDelta += d; } });
  return { lines, delta: r2(delta), ipLines, ipDelta: r2(ipDelta), exc: b.exc.length - a.exc.length };
}

export { thursdayOf };

/*
 * Finance's operating rules. Everything here is edited on Finance setup
 * (maker-checker like any other settings change). Stored in cfg.settings.ops.
 */
export const DEFAULT_OPS = {
  payDay: 4, // kept for older settings; the pay cycle below decides pay day (Jovial, 5 Nov: monthly)
  // the monthly pay cycle (Commissions flow Q11, Q12, Q15): lines eligible by the cut-off go on that month's invoice;
  // the RP downloads it, adds its own number, signs and uploads it; Finance checks it and pays by the pay-by day
  cycle: { cutoffDay: 31, payByDay: 10 }, // 31 = the last day of the month; pay by the 10th of the next month
  invoiceReminders: [3, 7, 14], // days after the cut-off, while an RP hasn't uploaded its invoice
  invoiceChecks: ['The amounts match the system invoice', 'Addressed to the right upGrad entity, with both tax numbers', 'The RP’s own invoice number and date', 'Signed', 'The bank details match the verified account'],
  sendBackReasons: ['Amounts don’t match the system invoice', 'Wrong upGrad entity or tax number', 'Invoice number or date missing', 'Not signed', 'Bank details don’t match', 'File can’t be read'],
  diffReasons: ['Rate dispute', 'Student not recognised', 'Exchange rate difference', 'Bank charges', 'Paid more than invoiced', 'Other'],
  overdueReminders: [0, 7, 14], // days after an invoice's due date
  // the upGrad entity that invoices universities in a destination country and pays RPs in a sales region (Q13, Q26)
  entities: [
    { id: 'AU', name: 'upGrad Education Pty Ltd', prefix: 'UGA', destinations: ['AU', 'NZ'], rpRegions: [] },
    { id: 'UK', name: 'upGrad Global Study Partners Ltd (UK)', prefix: 'UGU', destinations: ['UK', 'IE'], rpRegions: [] },
    { id: 'IN', name: 'upGrad Education Private Limited', prefix: 'UGI', destinations: [], rpRegions: ['India'] },
    { id: 'SG', name: 'upGrad Global Pte Ltd', prefix: 'UGS', destinations: ['US', 'CA'], rpRegions: [] },
  ],
  rctiPrefix: 'INV',
  batches: [{ id: 'AU', name: 'Batch 1 · Australian bank accounts', bank: 'AU' }, { id: 'Local', name: 'Batch 2 · Local bank accounts', bank: 'Local' }],
  // no second-person check anywhere (Jovial, 5 Nov: Commissions flow Q1, Q17, Q35): one Finance person enters, saves and pays
  makerChecker: { terms: false, settings: false, run: false },
  adminAbove: null,
  // how far ahead Finance home and Commission terms look (HC45): annuity lines and notices ending, contracts ending
  lookAhead: { annuity: 31, notices: 31, contracts: 90 },
  exceptions: [
    { type: 'No university terms', blocks: true, sla: 2, to: 'q-finance' },
    { type: 'Rate missing', blocks: true, sla: 2, to: 'q-finance' },
    { type: 'Contract ended', blocks: true, sla: 5, to: 'q-institution' },
    { type: 'RP has no terms', blocks: false, sla: 2, to: 'q-finance' },
    { type: 'RP terms not in force', blocks: true, sla: 2, to: 'q-finance' },
    { type: 'No RP', blocks: true, sla: 2, to: 'q-rp-ops' },
    { type: 'Student type missing', blocks: false, sla: 1, to: 'officer' },
    { type: 'Send to Legal', blocks: true, sla: 5, to: 'legal' },
  ],
  jobs: [
    { id: 'j-fx', name: 'Confirm this week’s FX rates', freq: 'weekly', day: 1, who: '', page: 'gspx-fin-setup', metric: 'fx' },
    // the monthly cycle: check RP invoices as they arrive; pay by the pay-by day
    { id: 'j-rpinv', name: 'Check the RP invoices uploaded', freq: 'daily', day: 0, who: '', page: 'gspx-fin-run', metric: 'run' },
    { id: 'j-appr', name: 'Pay the approved RP invoices', freq: 'monthly', day: 10, who: 'u-suman1-verma', page: 'gspx-fin-run', metric: 'run' },
    { id: 'j-inv', name: 'Raise university invoices', freq: 'daily', day: 0, who: '', page: 'gspx-fin-uni', metric: 'invoices' },
    { id: 'j-pay', name: 'Record university payments and chase overdue ones', freq: 'daily', day: 0, who: '', page: 'gspx-fin-uni', metric: 'overdue' },
    { id: 'j-exc', name: 'Work the exceptions', freq: 'daily', day: 0, who: '', page: 'gspx-fin-exc', metric: 'exceptions' },
    { id: 'j-mail', name: 'Clear the Commission mailbox', freq: 'daily', day: 0, who: '', page: 'gspx-mail', metric: 'mail' },
    { id: 'j-ann', name: 'Confirm continuing students for annuity', freq: 'monthly', day: 5, who: '', page: 'gspx-fin-uni', metric: 'annuity' },
    { id: 'j-end', name: 'Review contracts and notices ending soon', freq: 'monthly', day: 1, who: '', page: 'gspx-fin-terms', metric: 'ending' },
    { id: 'j-rec', name: 'Month-end reconciliation with Xero', freq: 'monthly', day: 28, who: 'u-suman1-verma', page: 'gspx-fin-reports', metric: '' },
  ],
};
export const opsOf = cfg => {
  const o = { ...DEFAULT_OPS, ...(cfg.settings.ops || {}), lookAhead: { ...DEFAULT_OPS.lookAhead, ...((cfg.settings.ops || {}).lookAhead || {}) } };
  // settings saved before 5 Nov may still ask for a checker; nothing does now
  return { ...o, makerChecker: { terms: false, settings: false, run: false }, cycle: { ...DEFAULT_OPS.cycle, ...(o.cycle || {}) } };
};

/* ---------- the monthly pay cycle (Jovial, 5 Nov) ---------- */
const ymd = (y, m, d) => new Date(Date.UTC(y, m, Math.min(d, new Date(Date.UTC(y, m + 1, 0)).getUTCDate()))).toISOString().slice(0, 10);
/** The cycle a date falls in: its key (YYYY-MM), its cut-off and the day it's paid by. */
export function cycleOf(cfg, date) {
  const { cutoffDay, payByDay } = opsOf(cfg).cycle;
  const d = new Date(date + 'T00:00:00Z'); let y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (date > ymd(y, m, cutoffDay)) { m += 1; if (m > 11) { m = 0; y += 1; } }
  const cutoff = ymd(y, m, cutoffDay);
  const payBy = ymd(m === 11 ? y + 1 : y, (m + 1) % 12, payByDay);
  return { key: `${y}-${String(m + 1).padStart(2, '0')}`, cutoff, payBy, label: new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
}
/** The last closed cycle on a date: the one whose cut-off has passed and whose invoices are being raised now. */
export function openCycle(cfg, date) {
  const cur = cycleOf(cfg, date);
  const d = new Date(cur.cutoff + 'T00:00:00Z'); d.setUTCDate(1); d.setUTCDate(0);
  return cycleOf(cfg, d.toISOString().slice(0, 10));
}
/** The upGrad entity for a university's destination country, or an RP's sales region. */
export const entityFor = (cfg, { destination, rpRegion }) => {
  const E = opsOf(cfg).entities;
  return (destination ? E.find((e) => e.destinations.includes(destination)) : E.find((e) => e.rpRegions.includes(rpRegion))) || E[0];
};
/** The exception types the engine raises itself: they can't be removed from Finance setup, only routed. */
export const ENGINE_EXCEPTIONS = DEFAULT_OPS.exceptions.map(x => x.type);


export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** How the pay day reads, from Finance setup: every "paid …" line reads it (monthly since 5 Nov). */
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
export const payDayName = cfg => `the ${ord(opsOf(cfg).cycle.payByDay)} of each month`;

/* The pay-by day of the cycle a date falls in. */
export function payDayOf(cfg, date) { return cycleOf(cfg, date).payBy; }

/* Is a recurring job due on this date? */
export function jobDue(cfg, job, date) {
  const d = new Date(date + 'T00:00:00Z'); const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  if (job.freq === 'daily') return true;
  if (job.freq === 'weekly') return dow === Number(job.day);
  if (job.freq === 'payday') return dow === opsOf(cfg).payDay;
  if (job.freq === 'monthly') return d.getUTCDate() === Number(job.day);
  return false;
}

/* Hand-off between pages: a filter to open with. */
export const nav = { filter: null };

/* Download a table as CSV (works from a local file). */
export function downloadCsv(name, head, rows) {
  const esc = v => { const t = v == null ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const csv = [head, ...rows].map(r => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
