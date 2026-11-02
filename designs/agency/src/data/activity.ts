/**
 * Activity by kind, and who sees which (Jovial, 2 Nov): RP roles see only chat, documents and commission activity;
 * mail and submission activity (and the status moves GSP makes) are GSP's. Every line of an application's history
 * has one kind: its own `kind` when it was written with one, else read from what it says.
 */
import type { Event } from './applications';

export type ActivityKind = 'chat' | 'documents' | 'commission' | 'mail' | 'submission' | 'status';
/** Who sees which kinds. GSP roles see every kind. */
export const ACTIVITY_SEEN_BY: Record<'rp' | 'gsp', ActivityKind[]> = {
  rp: ['chat', 'documents', 'commission'],
  gsp: ['chat', 'documents', 'commission', 'mail', 'submission', 'status'],
};
/** How a line without its own kind is read, first match wins. */
const READ: [RegExp, ActivityKind][] = [
  [/\bmail\b|e-?mail|inbox|forwarded|replied to/i, 'mail'],
  [/university reference|no reference id|submission|portal login|password|submitted to /i, 'submission'],
  [/commission|tuition fee|census date|invoice|payout|clawback/i, 'commission'],
  [/upload|document|sent back|verified|accepted the|rejected the|marksheet|passport|letter|\bfile\b|\.pdf|took \d+|read it first|checked the files|sent .* to GSP/i, 'documents'],
  [/asked (the RP )?for|request|condition|message|chat|chase/i, 'chat'],
];
export const activityKind = (e: Pick<Event, 'text'> & { kind?: ActivityKind }): ActivityKind => e.kind ?? READ.find(([re]) => re.test(e.text))?.[1] ?? 'status';
/** The lines a side sees. */
export const activityFor = <T extends Pick<Event, 'text'> & { kind?: ActivityKind }>(side: 'rp' | 'gsp', list: T[]) => list.filter((e) => ACTIVITY_SEEN_BY[side].includes(activityKind(e)));
