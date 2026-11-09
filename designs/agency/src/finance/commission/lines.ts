/**
 * Commission lines (Jovial, 9 Nov): which lines a view shows, and the CSV it exports. Pure, so the page and the
 * tests use the same filter: Export CSV downloads exactly the lines shown (the switch, the status tab, the filters,
 * Due between and the search).
 */
import type { Tx } from './engine';
import { SIDES, groupOf, type GroupKey, type Side } from './model';

export type LineView = {
  side: Side;
  tab: GroupKey | 'all';
  /** University ids (Universities) or RP ids (RPs). */
  who: string[];
  regions: string[];
  types: string[];
  statuses: string[];
  from: string;
  to: string;
  q: string;
};
export const blankView = (side: Side): LineView => ({ side, tab: 'all', who: [], regions: [], types: [], statuses: [], from: '', to: '', q: '' });

/** The lines a view shows, soonest due first. */
export function filterLines(txs: Tx[], v: LineView, invoiceNo: (t: Tx) => string = (t) => t.invoice ?? ''): Tx[] {
  const q = v.q.trim().toLowerCase();
  return txs
    .filter((t) => t.side === v.side)
    .filter((t) => v.tab === 'all' || groupOf(t.side, t.status) === v.tab)
    .filter((t) => !v.who.length || v.who.includes(v.side === 'uni' ? t.uni : t.rp))
    .filter((t) => !v.regions.length || v.regions.includes(t.region))
    .filter((t) => !v.types.length || v.types.includes(t.type))
    .filter((t) => !v.statuses.length || v.statuses.includes(t.status))
    .filter((t) => (!v.from || t.due >= v.from) && (!v.to || t.due <= v.to))
    .filter((t) => !q || [t.student, t.app, t.id, invoiceNo(t)].some((x) => x.toLowerCase().includes(q)))
    .sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
}

/** What the filters say, for Admin › Logs: "RPs · In progress · Due 2026-11-01 to 2026-11-30". */
export const viewText = (v: LineView, names: (id: string) => string) =>
  [
    v.side === 'uni' ? 'Universities' : 'RPs',
    v.tab === 'all' ? 'All' : v.tab,
    v.who.length ? v.who.map(names).join(', ') : '',
    v.regions.join(', '),
    v.types.join(', '),
    v.statuses.join(', '),
    v.from || v.to ? `Due ${v.from || '…'} to ${v.to || '…'}` : '',
    v.q ? `“${v.q}”` : '',
  ]
    .filter(Boolean)
    .join(' · ');

/** commission-lines.csv: one row per transaction, with its item and application. */
export function csvRows(txs: Tx[]): (string | number)[][] {
  return [
    ['Transaction ID', 'Type', 'Commission item', 'What it’s for', 'GSP ID', 'Student', 'University', 'Course', 'Intake', 'RP', 'Sales region', 'Due', 'Amount', 'Currency', 'Status', 'Invoice', 'Matches', 'Overridden'],
    ...txs.map((t) => [t.id, t.type, SIDES[t.side], t.what, t.app, t.student, t.uniName, t.course, t.intake, t.rpName, t.region, t.due, t.amount, t.currency, t.status, t.invoice ?? '', t.matches ?? '', t.override ? `${t.override.by}: ${t.override.reason}` : '']),
  ];
}
