// @ts-nocheck -- typed with the finance API.
/*
 * Commission transactions (Jovial, 6 Nov): each transaction's type and its status in the simple set, worked out from
 * the commission engine's own line. The two status lists are the one source for the Commission lines page (its
 * filters and the order a line's worst status is picked in).
 */
import { TONE } from './shared';

/* ---------- each transaction, in one shape for both sides ---------- */

/** A university transaction's type, from its line. */
export const uniType = (l) => (l.bonus ? 'Bonus from the university' : l.topup ? 'Top-up' : l.type === 'additional' ? 'Additional commission' : l.annuity ? 'Commission after year 1' : 'Commission');
/** An agency transaction's type, from its line. */
export const rpType = (x) => (x.kind === 'pct' ? (x.annuity ? 'Commission after year 1' : x.additional ? 'Additional commission' : 'Commission') : 'Bonus to the RP');

/** The simple status set (6 Nov), from the engine's own status. */
export function uniStatus(l) {
  const s = l.st[0];
  if (/^(Ready|Top-up) to invoice/.test(s)) return ['Ready to invoice', 'dpill--checking'];
  if (s === 'Payment overdue') return ['Overdue', 'dpill--bad'];
  if (s === 'Invoiced') return ['Invoiced', ''];
  if (s === 'Paid') return ['Paid', 'dpill--verified'];
  if (/^Held/.test(s)) return ['Held', 'dpill--bad'];
  if (/recovers|Credit/.test(s)) return ['Recovering', 'dpill--bad'];
  if (s === 'Not payable') return ['Not payable', ''];
  return ['Not yet due', ''];
}
export function rpStatus(x, inv) {
  const s = x.st[0];
  if (/^Held/.test(s)) return ['Held', 'dpill--bad'];
  if (x.due < 0) return ['Recovering', 'dpill--bad'];
  if (inv && x.due > 0) return [inv.status === 'approved' ? 'On RP invoice, approved' : inv.status === 'review' ? 'On RP invoice, to check' : 'On RP invoice', 'dpill--checking'];
  if (x.payable && x.due > 0) return ['Ready to pay', 'dpill--checking'];
  if (s === 'Paid') return ['Paid', 'dpill--verified'];
  if (/^Waiting/.test(s)) return ['Waiting for university', ''];
  if (s === 'Cannot price') return ['Can’t price', 'dpill--bad'];
  return [s, TONE[x.st[1]] || ''];
}
/** In the order a line shows its worst: the most urgent first. */
export const UNI_STATUSES = ['Overdue', 'Held', 'Recovering', 'Ready to invoice', 'Invoiced', 'Not yet due', 'Paid', 'Not payable'];
export const RP_STATUSES = ['Held', 'Recovering', 'Can’t price', 'Ready to pay', 'On RP invoice', 'Waiting for university', 'Paid'];

