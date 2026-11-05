// @ts-nocheck -- typed with the finance API.
/**
 * The RP's monthly invoice (Jovial, 5 Nov: Commissions flow Q11–Q21). Once a cycle's lines are eligible (GSP has been
 * paid for them), the RP downloads the system invoice for the cycle, adds its own invoice number and date, signs it
 * and uploads it. Finance checks it (a checklist from Finance setup), approves it or sends it back with a reason, and
 * pays it by the cycle's pay-by day, marking it paid with the bank reference. One Finance person does all of it.
 *
 * Stored on the commission data as `rpInv`: { [cycle|rp]: invoice }. An invoice keeps a snapshot of its lines, so a
 * line on an invoice that isn't paid yet never goes on another one.
 */
import { money, r2, nice } from './engine';
import { cycleOf, entityFor, opsOf } from './shared';

export const invKey = (cycle, rpId) => `${cycle}|${rpId}`;

/** Where an invoice is: the RP has downloaded it, uploaded it, Finance sent it back, approved it, or paid it. */
export const INV_STATUS = {
  draft: ['Downloaded, not uploaded', 'dpill--checking'],
  review: ['Invoice in review', 'dpill--checking'],
  sentback: ['Sent back', 'dpill--bad'],
  approved: ['Approved', 'dpill--verified'],
  paid: ['Paid', 'dpill--verified'],
};

/** The lines already on an invoice that isn't paid yet (they can't go on another one). */
export function onInvoice(c) {
  const m = new Map();
  Object.values(c.rpInv || {}).forEach((inv) => { if (inv.status !== 'paid') inv.lines.forEach((L) => m.set(L.app + '|' + L.key, inv)); });
  return m;
}

/** An RP line's status, as the RP and Finance see it (Q21). */
export function rpLineStatus(c, x, today, held) {
  const inv = onInvoice(c).get(x.app + '|' + x.key);
  if (inv) return inv.status === 'draft' ? 'ready' : inv.status;
  if (x.due < 0) return 'recover';
  if (x.due === 0 && x.paid) return 'paid';
  if (x.payable && x.due > 0) return held ? 'hold' : 'ready';
  return x.ip && x.ip.date > today ? 'expected' : 'wait';
}
export const LINE_STATUS = {
  expected: ['Expected', ''],
  wait: ['Waiting for the university', ''],
  ready: ['Ready to invoice', 'dpill--checking'],
  review: ['Invoice in review', 'dpill--checking'],
  sentback: ['Sent back', 'dpill--bad'],
  approved: ['Approved', 'dpill--verified'],
  paid: ['Paid', 'dpill--verified'],
  hold: ['On hold', 'dpill--bad'],
  recover: ['Recovered', 'dpill--bad'],
};

/** The RP's effective % of the fee on a line (Q20): never GSP's rate or GSP's amount. */
export function effectivePct(x) {
  const base = x.ip && x.ip.base ? +x.ip.base : null;
  return base ? r2((x.ent / base) * 100) : null;
}

/** A new invoice for the RP's lines in this cycle (the payee's lines from the live run, not yet on an invoice). */
export function newInvoice(c, run, rp, user) {
  const cyc = cycleOf(c.cfg, c.today);
  const p = run.payees[rp.id]; if (!p) return null;
  const taken = onInvoice(c);
  const lines = p.lines.filter((L) => !taken.has(L.app + '|' + L.key) && L.pay != null);
  if (!lines.length) return null;
  const byCur = {}; lines.forEach((L) => { const b = (byCur[L.payCur] = byCur[L.payCur] || { net: 0, gst: 0, wht: 0 }); b.net = r2(b.net + L.pay); b.gst = r2(b.gst + L.gst); b.wht = r2(b.wht + L.wht); });
  const total = Object.fromEntries(Object.entries(byCur).map(([k, v]) => [k, r2(v.net + v.gst - v.wht)]));
  const ent = entityFor(c.cfg, { rpRegion: rp.region });
  const n = Object.values(c.rpInv || {}).filter((i) => i.cycle === cyc.key).length + 1;
  return {
    id: invKey(cyc.key, rp.id), ref: `${opsOf(c.cfg).rctiPrefix}-${cyc.key.replace('-', '')}-${String(n).padStart(3, '0')}`,
    cycle: cyc.key, cycleLabel: cyc.label, payBy: cyc.payBy, rp: rp.id, rpName: rp.name, entity: ent ? { name: ent.name, id: ent.id } : null,
    lines: lines.map((L) => ({ app: L.app, key: L.key, label: L.label, student: L.student, src: L.src, srcCur: L.srcCur, pay: L.pay, payCur: L.payCur, gst: L.gst, wht: L.wht })),
    byCur, total, status: 'draft', made: Date.now(), madeBy: user.id, history: [{ at: Date.now(), by: user.name, what: 'Downloaded the system invoice' }],
  };
}

/** The system invoice as a printable page the RP downloads, fills in and signs (Q13). */
export function invoiceHtml(inv, rp) {
  const rows = inv.lines.map((L) => `<tr><td>${L.student}</td><td>${L.app}</td><td>${L.label}</td><td style="text-align:right">${money(L.pay, L.payCur)}</td></tr>`).join('');
  const tot = Object.entries(inv.byCur).map(([k, v]) => `<tr><td colspan="3">Commission (${k})</td><td style="text-align:right">${money(v.net, k)}</td></tr>${v.gst ? `<tr><td colspan="3">Tax added</td><td style="text-align:right">${money(v.gst, k)}</td></tr>` : ''}${v.wht ? `<tr><td colspan="3">Tax withheld by upGrad</td><td style="text-align:right">-${money(v.wht, k)}</td></tr>` : ''}<tr><td colspan="3"><b>Total payable (${k})</b></td><td style="text-align:right"><b>${money(r2(v.net + v.gst - v.wht), k)}</b></td></tr>`).join('');
  // the tag names are split so the page's own build never mistakes them for its stylesheet or title
  const T = 'title', S = 'style';
  return `<!doctype html><meta charset="utf-8"><${T}>Invoice ${inv.ref}</${T}><${S}>body{font:14px system-ui;margin:40px;color:#111}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}.blank{border:1px dashed #999;padding:8px;margin:4px 0}</${S}>
<h1>Tax invoice</h1><p>System reference ${inv.ref} · ${inv.cycleLabel} · pay by ${nice(inv.payBy)}</p>
<h3>From</h3><p>${rp.name}<br>${rp.address || ''}<br>Tax number: ${rp.taxNo || '<span class="blank">add your GSTIN, ABN or PAN</span>'}</p>
<h3>To</h3><p>${inv.entity ? inv.entity.name : 'upGrad'}</p>
<p>Your invoice number: <span class="blank">add your own number</span> &nbsp; Invoice date: <span class="blank">add the date</span></p>
<table><tr><th>Student</th><th>Application</th><th>Line</th><th style="text-align:right">Amount</th></tr>${rows}${tot}</table>
<p>Pay to the account ending ${rp.bankLast4 ? '••' + rp.bankLast4 : 'on file with upGrad'}.</p><p>Signature: <span class="blank">sign here</span></p>`;
}

/** Save a file to the viewer's computer (works from a local file). */
export function downloadFile(name, text, type = 'text/html') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
