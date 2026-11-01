import { renewalDays } from '../../work/renewal';
/**
 * The Institution Team's queue (29 Oct, 2nd round, after the PM prototype's My queues): every task waiting on the
 * team, made from the records as they stand, oldest first. A task leaves the queue when its record no longer needs
 * it. Each has who it's for (a relationship manager, or anyone in the team) and is late once it has waited longer
 * than usual. 29 Oct (7th round): no Changes tab, so no Verify a change.
 */
import { agreementOf, canGoLive, checkedAt, daysAgo, daysTo, endsText, isoOf, stagesOf, type InstitutionPartner } from './records';
import type { CourseRec, UniRec } from './catalogue';

export const TASK_TYPES = ['Renew an agreement', 'Get a university live', 'Finish draft courses'] as const;
export type TaskType = (typeof TASK_TYPES)[number];
/** Anyone in the team can take it. */
export const ANYONE = 'Institution Team';

export type Task = {
  id: string;
  type: TaskType;
  item: string;
  sub: string;
  who: string;
  /** Waiting since. */
  since: string;
  late: boolean;
  /** Where it's done. */
  open: { section: 'ips' | 'universities' | 'catalogue'; id: string; tab?: string };
};

const plus = (iso: string, days: number) => isoOf(new Date(new Date(`${iso}T00:00:00`).getTime() + days * 86_400_000));

export function tasksFor(ips: InstitutionPartner[], unis: UniRec[], courses: CourseRec[]): Task[] {
  const ip = new Map(ips.map((p) => [p.id, p]));
  const rmOf = (u: UniRec) => ip.get(u.ip)?.rm ?? ANYONE;
  const out: Task[] = [];

  for (const u of unis) {
    const p = ip.get(u.ip);
    if (u.status === 'Setting up' && canGoLive(p)) out.push({ id: `t-live-${u.id}`, type: 'Get a university live', item: u.name, sub: `Under ${p!.name}: add its courses and submission, then go live`, who: rmOf(u), since: u.added, late: daysAgo(u.added) > 14, open: { section: 'universities', id: u.id } });
    const drafts = courses.filter((c) => c.uni.id === u.id && c.status === 'Draft');
    if (drafts.length) out.push({ id: `t-draft-${u.id}`, type: 'Finish draft courses', item: u.name, sub: drafts.length === 1 ? `${drafts[0].name}: add its details and publish` : `${drafts.length} drafts: add their details and publish`, who: ANYONE, since: isoOf(new Date(checkedAt(drafts[0].checked))), late: false, open: { section: 'universities', id: u.id, tab: 'courses' } });
  }
  for (const p of ips) {
    const st = stagesOf(p);
    const a = agreementOf(p);
    if (!a || !(st.includes('ending') || st.includes('ended'))) continue;
    out.push({ id: `t-renew-${p.id}`, type: 'Renew an agreement', item: p.name, sub: `${endsText(a.end)}: add the renewal under Documents`, who: p.rm, since: plus(a.end, -renewalDays()), late: daysTo(a.end) < 21, open: { section: 'ips', id: p.id, tab: 'documents' } });
  }
  return out.sort((a, b) => a.since.localeCompare(b.since));
}
