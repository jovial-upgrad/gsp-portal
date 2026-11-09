/**
 * My work in GSP · Finance: this role's own copy of the page (Nesil, 5 and 6 Nov). Since 9 Nov (Jovial) its queue, leader
 * and people are GSP · Admin's seeded queue, and every task is made by a task rule from the seeded records (see
 * admin/data/mywork.ts): its title is the rule's task, its ID is shown under it, and a late task is simply Breached.
 * A queue no rule sends work to has no tasks. Times are working hours (9 a working day).
 */
import { queueWork } from '../../admin/data/mywork';
export type IwTask = { id: string; title: string; rule: string; rp: string; region: string; queue: string; assignee: string; waited: number; sla: number; canComplete: boolean; done?: boolean };

/** The queue as GSP · Admin seeds it (9 Nov), and the tasks its task rules make from the seeded records. */
const WORK = queueWork('Finance');
export const QUEUE = WORK.queue;
export const LEADER = WORK.leader;
export const TEAM = WORK.team;

export type Standing = 'track' | 'soon' | 'late' | 'done';
export const STANDING: Record<Standing, string> = { track: 'On track', soon: 'Due soon', late: 'Breached', done: 'Completed' };
export const standingOf = (t: IwTask): Standing => {
  if (t.done) return 'done';
  const left = t.sla - t.waited;
  return left < 0 ? 'late' : left <= 9 ? 'soon' : 'track';
};
export const whText = (wh: number) => {
  const n = Math.abs(wh);
  if (n < 9) return `${n} working ${n === 1 ? 'hour' : 'hours'}`;
  const d = Math.round(n / 9);
  return `${d} working ${d === 1 ? 'day' : 'days'}`;
};
export const whShort = (wh: number) => (wh < 9 ? `${wh} wh` : `${Math.round(wh / 9)} wd`);
/** "Due Fri 6 Nov", counted from Thu 5 Nov 2026, 2:15 pm (4.25 working hours left today). */
export const dueDate = (left: number) => {
  const d = new Date('2026-11-05T14:15:00');
  let rest = left - 4.25;
  while (rest > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) rest -= 9;
  }
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const sampleIwTasks = (): IwTask[] => 
  WORK.tasks.map((t) => ({ id: t.id, title: t.title, rule: t.rule, rp: t.about, region: t.region, queue: QUEUE, assignee: t.assignee, waited: t.waited, sla: t.sla, canComplete: t.canComplete }));
