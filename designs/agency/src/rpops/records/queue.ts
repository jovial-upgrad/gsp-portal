/**
 * RP Ops' queue (Nesil, 4 Nov, later: a Home, as GSP · Institution has): what's waiting on RP Ops, and on the RPs,
 * made from the recruitment partners as they stand, oldest first. A task leaves the queue once its record moves on:
 * verify the documents, send the agreement, accept or send back the signed copy. Waiting on the RP: an agreement out
 * to sign, documents sent back, and new partners with documents still to upload. Late once it has waited longer than
 * usual for its kind.
 */
import { agreementsOf, allVerified, type OpsRp } from './data';

export type TaskKind = 'verify' | 'send' | 'check' | 'rp' | 'new';
export type OpsTask = {
  id: string;
  kind: TaskKind;
  /** What to do, as the Task column says it. */
  type: string;
  sub: string;
  rp: OpsRp;
  /** Waiting since (ms). */
  since: number;
  late: boolean;
  /** Where it's done. */
  tab: 'overview' | 'documents';
};

const DAY = 86_400_000;
/** Days a task can wait before it's late. */
const LATE: Record<TaskKind, number> = { verify: 2, send: 3, check: 1, rp: 7, new: 7 };
const day = (iso: string) => Date.parse(`${iso.slice(0, 10)}T09:00:00`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "Today", "1 day", "12 days". */
export const waited = (t: number) => {
  const n = Math.floor((Date.now() - t) / DAY);
  return n <= 0 ? 'Today' : n === 1 ? '1 day' : `${n} days`;
};

export function tasksOf(rps: OpsRp[]): OpsTask[] {
  const out: OpsTask[] = [];
  const add = (r: OpsRp, kind: TaskKind, type: string, sub: string, since: number, tab: OpsTask['tab'] = 'documents') =>
    out.push({ id: `${kind}-${r.id}`, kind, type, sub, rp: r, since, late: Date.now() - since > LATE[kind] * DAY, tab });
  for (const r of rps) {
    if (r.status === 'Rejected' || r.status === 'Suspended' || r.status === 'Dormant') continue;
    const toVerify = r.docs.filter((d) => d.state === 'With BAP');
    const missing = r.docs.filter((d) => d.state === 'Missing');
    const back = r.docs.filter((d) => d.state === 'Sent back');
    const uploaded = r.activity.find((e) => /documents uploaded/i.test(e.what));
    const { active, moving } = agreementsOf(r);
    const lastDecision = Math.max(0, ...r.docs.map((d) => d.at ?? 0));

    if (toVerify.length) add(r, 'verify', 'Verify documents', `${plural(toVerify.length, 'document')} to verify`, day(uploaded?.at ?? r.since));
    if (r.status === 'Not activated' && missing.length) add(r, 'new', 'Not activated', `${plural(missing.length, 'document')} still to upload`, day(r.since), 'overview');
    if (back.length) add(r, 'rp', 'Documents sent back', `${back.map((d) => d.name).join(', ')}: waiting for a new copy`, Math.max(...back.map((d) => d.at ?? day(r.since))));
    if (allVerified(r) && !active && !moving) add(r, 'send', 'Send the agreement', 'Every document is verified', lastDecision || day(r.since));
    if (moving?.status === 'draft') add(r, 'send', 'Send the agreement', `${moving.version} is saved as a draft`, lastDecision || day(r.since));
    if (moving?.status === 'signed' && moving.signed) add(r, 'check', 'Check the signed copy', `${moving.version}, uploaded by ${moving.signed.by}`, moving.signed.at);
    if (moving?.status === 'sent' && moving.sent) add(r, 'rp', 'Agreement with the RP', `${moving.version}: to sign and upload`, moving.sent.at);
    if (moving?.status === 'sent-back' && moving.decision) add(r, 'rp', 'Signed copy sent back', `${moving.version}: waiting for a new signed copy`, moving.decision.at);
  }
  return out.sort((a, b) => a.since - b.since);
}
