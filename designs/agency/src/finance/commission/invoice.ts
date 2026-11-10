/**
 * Invoices (Jovial, 9 Nov): GSP's invoice to a university (Raise invoice) and GSP's filled-in invoice for an RP (Earnings'
 * Download GSP's invoice), laid out like the RPs' own invoices: who it's from, who it's billed to, the invoice number and
 * date, a row per transaction, tax when the RP is registered for it, the total and the bank details. Everything comes
 * from the records and the lines; the page shows it in a preview and downloads it as a printable page.
 */
import type { Tx } from './engine';
import { addDays, sumBy } from './engine';
import { dayText, money, type Bank, type CommState } from './model';

export type InvoiceDoc = {
  title: string;
  number: string;
  date: string;
  due?: string;
  from: { name: string; lines: string[] };
  to: { name: string; lines: string[] };
  columns: string[];
  rows: string[][];
  /** Amounts by currency: the subtotal, any tax, and the total. */
  totals: { label: string; value: string; strong?: boolean }[];
  bank?: { label: string; value: string }[];
  notes: string[];
  sign?: string;
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const studyPeriod = (t: Tx) => (t.period ? `Study period ${t.period}` : t.type);

/** GSP's invoice to a university for some of its lines. */
export function uniInvoice(state: CommState, inv: { number: string; date: string; uni: string }, txs: Tx[], uni: { name: string; country: string }): InvoiceDoc {
  const terms = state.terms.find((t) => t.uni === inv.uni);
  const sums = sumBy(txs);
  return {
    title: 'Tax invoice',
    number: inv.number,
    date: inv.date,
    due: terms ? addDays(inv.date, terms.payDays) : undefined,
    from: state.settings.gsp,
    to: { name: uni.name, lines: [uni.country] },
    columns: ['Transaction ID', 'GSP ID', 'Student', 'Course', 'Intake', 'What it’s for', 'Amount'],
    rows: txs.map((t) => [t.id, t.app, t.student, t.course, t.intake, t.what, money(t.amount, t.currency)]),
    totals: Object.entries(sums).map(([c, n]) => ({ label: `Total (${c})`, value: money(n, c), strong: true })),
    notes: [terms ? `Payment due within ${terms.payDays} days of this invoice.` : '', 'Quote the invoice number with your payment.'].filter(Boolean),
  };
}

/**
 * GSP's filled-in invoice for an RP's requested lines: the RP's business name, address and tax ID, the date, billed
 * to GSP; per line its transaction ID, GSP ID, student, university, course, intake, study period and amount; the tax
 * line when the RP is registered for tax; the total; and the RP's bank details. The RP signs it and uploads it.
 */
export function rpInvoice(state: CommState, rp: { id: string; code: string; name: string; city: string; state?: string; country: string }, txs: Tx[], date: string): InvoiceDoc {
  const rec = state.records.find((r) => r.rp === rp.id);
  const bank: Bank | undefined = state.banks.find((b) => b.rp === rp.id);
  const tax = rec?.tax ? state.settings.tax[rp.country] : undefined;
  const sums = sumBy(txs);
  const totals: InvoiceDoc['totals'] = [];
  Object.entries(sums).forEach(([c, n]) => {
    totals.push({ label: `Subtotal (${c})`, value: money(n, c) });
    const t = tax ? Math.round(n * tax.pct) / 100 : 0;
    if (tax) totals.push({ label: `${tax.name} ${tax.pct}% (${c})`, value: money(t, c) });
    totals.push({ label: `Total (${c})`, value: money(Math.round((n + t) * 100) / 100, c), strong: true });
  });
  return {
    title: tax ? 'Tax invoice' : 'Invoice',
    number: `${rp.code}-${date.replace(/-/g, '')}`,
    date,
    from: { name: rp.name, lines: [[rp.city, rp.state].filter(Boolean).join(', '), rp.country] },
    to: state.settings.gsp,
    columns: ['Transaction ID', 'GSP ID', 'Student', 'University', 'Course', 'Intake', 'Study period', 'Amount'],
    rows: txs.map((t) => [t.id, t.app, t.student, t.uniName, t.course, t.intake, studyPeriod(t), money(t.amount, t.currency)]),
    totals,
    bank: bank
      ? [
          { label: 'Bank', value: bank.bank },
          { label: 'Account name', value: bank.account },
          { label: 'Account number', value: bank.number },
          { label: 'SWIFT or BSB', value: bank.swift },
          { label: 'Bank address', value: bank.address },
          { label: 'Bank currency', value: bank.currency },
        ]
      : undefined,
    notes: ['Amounts are in each university’s currency, as GSP’s lines show them.', `To question an amount, email ${state.settings.disputeEmail} with the transaction ID.`],
    sign: `Signed for ${rp.name}`,
  };
}

/** The invoice as a printable page (the preview's frame, and the downloaded file). */
export function invoiceHtml(d: InvoiceDoc): string {
  const block = (h: string, p: { name: string; lines: string[] }) => `<div><p class="k">${h}</p><p class="b">${esc(p.name)}</p>${p.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.title)} ${esc(d.number)}</title><style>
  body{font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1b1f;margin:32px;background:#fff}
  h1{font-size:22px;margin:0 0 4px}p{margin:0}.k{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b6b76;margin-bottom:4px}.b{font-weight:600}
  .top{display:flex;justify-content:space-between;gap:24px;margin-bottom:24px}.meta{text-align:right}.meta p{margin-bottom:2px}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}th,td{padding:8px 6px;border-bottom:1px solid #e3e3ea;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b6b76}td:last-child,th:last-child{text-align:right;white-space:nowrap}
  .totals{margin-left:auto;width:min(100%,360px)}.totals div{display:flex;justify-content:space-between;padding:4px 0}.totals .s{font-weight:700;border-top:1px solid #1b1b1f;margin-top:4px;padding-top:8px}
  .bank{margin-top:24px;display:grid;grid-template-columns:max-content 1fr;gap:4px 16px}.notes{margin-top:24px;color:#4a4a55;font-size:12px}.sign{margin-top:48px;width:260px;border-top:1px solid #1b1b1f;padding-top:6px;font-size:12px}
  @media print{body{margin:16mm}}
  </style></head><body>
  <div class="top"><div><h1>${esc(d.title)}</h1><p>${esc(d.from.name)}</p></div><div class="meta"><p><span class="k">Invoice</span> ${esc(d.number)}</p><p><span class="k">Date</span> ${esc(dayText(d.date))}</p>${d.due ? `<p><span class="k">Due</span> ${esc(dayText(d.due))}</p>` : ''}</div></div>
  <div class="parties">${block('From', d.from)}${block('Bill to', d.to)}</div>
  <table><thead><tr>${d.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${d.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <div class="totals">${d.totals.map((t) => `<div class="${t.strong ? 's' : ''}"><span>${esc(t.label)}</span><span>${esc(t.value)}</span></div>`).join('')}</div>
  ${d.bank ? `<p class="k" style="margin-top:24px">Pay to</p><div class="bank">${d.bank.map((b) => `<span class="k">${esc(b.label)}</span><span>${esc(b.value)}</span>`).join('')}</div>` : ''}
  <div class="notes">${d.notes.map((n) => `<p>${esc(n)}</p>`).join('')}</div>
  ${d.sign ? `<p class="sign">${esc(d.sign)}</p>` : ''}
  </body></html>`;
}

/** Saves the invoice as a page to print or keep. */
export function downloadInvoice(d: InvoiceDoc) {
  const blob = new Blob([invoiceHtml(d)], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${d.number}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
