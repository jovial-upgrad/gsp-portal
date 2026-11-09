/**
 * My work in GSP · Admissions: this role's own copy of the page (Nesil, 5 and 6 Nov). Since 9 Nov (Jovial) its queue, leader
 * and people are GSP · Admin's seeded queue, and every task is made by a task rule from the seeded records (see
 * admin/data/mywork.ts): its title is the rule's task, its ID is shown under it, and a late task is simply Breached.
 * A queue no rule sends work to has no tasks. Times are working hours (9 a working day).
 */
import { queueWork } from '../../admin/data/mywork';
export type GwTask = { id: string; title: string; rule: string; ref: string; uni: string; region: string; queue: string; assignee: string; waited: number; sla: number; canComplete: boolean; done?: boolean };
export type GwWait = { id: string; student: string; ref: string; uni: string; status: string; on: 'RP' | 'University'; what: string; since: number; left: number | null };

export const ME = 'Freddy Forrest';
/** The queue as GSP · Admin seeds it (9 Nov), and the tasks its task rules make from the seeded records. */
const WORK = queueWork('India Admissions');
export const QUEUE = WORK.queue;
export const LEADER = WORK.leader;
export const TEAM = WORK.team;

export type Standing = 'track' | 'soon' | 'late' | 'done';
export const STANDING: Record<Standing, string> = { track: 'On track', soon: 'Due soon', late: 'Breached', done: 'Completed' };
export const standingOf = (t: GwTask): Standing => {
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

/** "Due Fri 6 Nov": the working day the time left runs out on, counted from Thu 5 Nov 2026, 2:15 pm (4.25 hours left today). */
export const dueDate = (left: number) => {
  const d = new Date('2026-11-05T14:15:00');
  let rest = left - 4.25;
  while (rest > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) rest -= 9;
  }
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const sampleGwTasks = (): GwTask[] => 
  WORK.tasks.map((t) => ({ id: t.id, title: t.title, rule: t.rule, ref: t.ref, uni: t.about, region: t.region, queue: QUEUE, assignee: t.assignee, waited: t.waited, sla: t.sla, canComplete: t.canComplete }));

export const sampleGwWaits = (): GwWait[] => [
  { id: 'w1', student: 'Priya Raman', ref: 'GSP-24102', uni: 'Deakin University', status: 'Conditional offer received, conditions pending', on: 'RP', what: 'Offer conditions', since: 9, left: 162 },
  { id: 'w2', student: 'Priya Raman', ref: 'GSP-24097', uni: 'University of Wollongong', status: 'Submitted to university', on: 'University', what: 'A decision', since: 81, left: -63 },
  { id: 'w3', student: 'Sneha Patil', ref: 'GSP-24055', uni: 'Flinders University', status: 'Pending verification', on: 'RP', what: 'Gap explanation document', since: 2, left: 27 },
  { id: 'w4', student: 'Sneha Patil', ref: 'GSP-24061', uni: 'University of Newcastle', status: 'Document re-upload pending', on: 'RP', what: 'Undergraduate transcript and degree certificate', since: 9, left: null },
  { id: 'w5', student: 'Sneha Patil', ref: 'GSP-24063', uni: 'Coventry University', status: 'Awaiting acceptance letter', on: 'University', what: 'Acceptance letter', since: 27, left: 4 },
  { id: 'w6', student: 'Rohan Nair', ref: 'GSP-24209', uni: 'University of Wales Trinity Saint David', status: 'Pending verification', on: 'RP', what: '12th marksheet', since: 9, left: 18 },
  { id: 'w7', student: 'Aarav Shah', ref: 'GSP-24110', uni: 'Abertay University', status: 'Submitted to university', on: 'University', what: 'A decision', since: 21, left: 24 },
  { id: 'w8', student: 'Tanvir Ahmed', ref: 'GSP-24071', uni: 'Coventry University', status: 'Deposit pending', on: 'RP', what: 'Deposit receipt', since: 30, left: 6 },
  { id: 'w9', student: 'Ayesha Khan', ref: 'GSP-24049', uni: 'University of Newcastle', status: 'Awaiting CoE', on: 'University', what: 'Confirmation of enrolment', since: 40, left: 23 },
  { id: 'w10', student: 'Meera Nair', ref: 'GSP-24120', uni: 'Abertay University', status: 'Pending verification', on: 'RP', what: 'Statement of purpose', since: 5, left: null },
];
