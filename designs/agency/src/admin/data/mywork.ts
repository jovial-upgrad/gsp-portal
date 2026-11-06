/**
 * My Work (Nesil, 5 Nov; after the reference's My work): the open tasks the task rules have made, and the records
 * waiting on someone outside GSP. Sample data, made from the task rules, the kinds of work and the queues, as at
 * 5 Nov 2026, 2:15 pm IST. Times are working hours (9 a working day).
 */
import type { Queue, User } from './config';
import { REGION_ADMISSIONS, REGION_RECRUITMENT, type TaskRule, type WorkKind } from './work';

export type RecordType = 'Application' | 'RP' | 'Institution partner' | 'University' | 'Course' | 'Setting' | 'Email' | 'Commission';
export type WorkTask = { id: string; title: string; kind: string; record: RecordType; region: string; queue: string; assignee: string; waited: number; sla: number; escalated?: string; done?: boolean };
export type Wait = { id: string; student: string; ref: string; uni: string; status: string; on: 'RP' | 'University'; what: string; since: number; left: number | null };

/** How a task stands against its SLA: left is working hours to go (below 0: late). */
export type Standing = 'track' | 'soon' | 'late' | 'done';
export const standing = (left: number): Standing => (left < 0 ? 'late' : left <= 9 ? 'soon' : 'track');
export const STANDING: Record<Standing, string> = { track: 'On track', soon: 'Due soon', late: 'Breached', done: 'Completed' };
export const taskStanding = (t: WorkTask): Standing => (t.done ? 'done' : standing(t.sla - t.waited));
/** "5 working hours", "3 working days". */
export const whText = (wh: number) => {
  const n = Math.abs(wh);
  if (n < 9) return `${n} working ${n === 1 ? 'hour' : 'hours'}`;
  const d = Math.round(n / 9);
  return `${d} working ${d === 1 ? 'day' : 'days'}`;
};
export const whShort = (wh: number) => (wh < 9 ? `${wh} wh` : `${Math.round(wh / 9)} wd`);

const STUDENTS = ['Priya Raman', 'Sneha Patil', 'Rohan Gupta', 'Aarav Shah', 'Nguyen Thi Lan', 'Tanvir Ahmed', 'Sujan Karki', 'Ayesha Khan', 'Kavya Iyer', 'Tran Minh Duc', 'Farhan Hossain', 'Meera Nair'];
const RPS = ['BrightPath Overseas', 'Educareer Services', 'IEMC Global', 'Visafast Migration', 'Nikee Business Group', 'AGS Advance Global Study'];
const UNIS = ['Deakin University', 'University of Wollongong', 'Flinders University', 'Coventry University', 'University of Newcastle', 'Abertay University'];
const RECORD: Record<string, RecordType> = { Applications: 'Application', RPs: 'RP', 'Institution partners': 'Institution partner', Email: 'Email', Commission: 'Commission', Admin: 'Setting', Escalation: 'Application' };

/** A small, repeatable random: the same sample every time. */
const rand = (seed: number) => () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

export function sampleTasks(rules: TaskRule[], kinds: WorkKind[], queues: Queue[], users: User[], me: string): WorkTask[] {
  const r = rand(7);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? '';
  const out: WorkTask[] = [];
  const live = rules.filter((x) => x.on && !x.fixed);
  for (let i = 0; i < 120; i++) {
    const rule = live[i % live.length];
    const k = kinds.find((x) => x.id === rule.kind);
    if (!k) continue;
    const pool = k.to === REGION_ADMISSIONS ? queues.filter((q) => q.type === 'Admissions') : k.to === REGION_RECRUITMENT ? queues.filter((q) => q.type === 'Recruitment') : queues.filter((q) => q.id === k.to);
    const q = pool.length ? pick(pool) : queues.find((x) => x.id === 'q-admin')!;
    const region = q.type === 'Team' ? pick(['India', 'Vietnam', 'Bangladesh', 'Nepal', 'Australia', 'Global']) : q.name.replace(/ (Admissions|Recruitment)$/, '');
    const sla = rule.sla ? (rule.sla.unit === 'hours' ? rule.sla.n : rule.sla.n * 9) : k.unit === 'hours' ? k.due : k.due * 9;
    const people = [q.lead, ...q.members].map(name).filter(Boolean);
    const assignee = rule.sharing === 'pick' || r() < 0.15 || !people.length ? '' : pick(people);
    const waited = Math.max(1, Math.round(r() * sla * 1.7));
    const late = waited - sla;
    const title = rule.task.replace('[student]', pick(STUDENTS)).replace(/\[(RP|IP or RP|partner)\]/, pick(RPS)).replace(/\[(university|IP)\]/, pick(UNIS)).replace('[sender]', pick(UNIS)).replace(/\[[a-z]+\]/, 'the record');
    out.push({ id: `t${i + 1}`, done: i % 9 === 4 || undefined, title, kind: k.id, record: RECORD[rule.cat] ?? 'Application', region, queue: q.id, assignee, waited, sla, escalated: late >= 45 ? 'Admin' : late >= 18 ? (q.type === 'Admissions' ? 'Admission Ops' : q.type === 'Recruitment' ? 'RP Ops' : q.name) : undefined });
  }
  // the signed-in admin's own: settings and failed jobs land in the Admin queue
  const mine: [string, string, number, number, string?][] = [
    ['Map Mongolian to a sales region', 'k-system', 15, 9],
    ['Fix the failed job: weekly course feed', 'k-system', 4, 9],
    ['Enter next week’s exchange rates', 'k-system', 2, 9],
    ['Reconnect admissions.india@upgrad.com', 'k-system', 3, 4],
    ['Move Kavya Iyer’s application on', 'k-escalated', 70, 9, 'Admin'],
  ];
  mine.forEach(([title, kind, waited, sla, esc], i) => out.push({ id: `m${i + 1}`, title, kind, record: kind === 'k-escalated' ? 'Application' : 'Setting', region: kind === 'k-escalated' ? 'India' : 'Global', queue: 'q-admin', assignee: me, waited, sla, escalated: esc }));
  return out;
}

export const sampleWaits = (): Wait[] => [
  { id: 'w1', student: 'Priya Raman', ref: 'GSP-24102', uni: 'Deakin University', status: 'Conditional offer, conditions pending', on: 'RP', what: 'Offer conditions', since: 9, left: 162 },
  { id: 'w2', student: 'Priya Raman', ref: 'GSP-24097', uni: 'University of Wollongong', status: 'Submitted to university', on: 'University', what: 'A decision', since: 81, left: -63 },
  { id: 'w3', student: 'Sneha Patil', ref: 'GSP-24055', uni: 'Flinders University', status: 'Pending verification', on: 'RP', what: 'Gap explanation document', since: 2, left: 27 },
  { id: 'w4', student: 'Sneha Patil', ref: 'GSP-24061', uni: 'University of Newcastle', status: 'Document re-upload pending', on: 'RP', what: 'Undergraduate transcript and degree certificate', since: 9, left: null },
  { id: 'w5', student: 'Sneha Patil', ref: 'GSP-24063', uni: 'Coventry University', status: 'Awaiting acceptance letter', on: 'University', what: 'Acceptance letter', since: 27, left: 4 },
  { id: 'w6', student: 'Rohan Gupta', ref: 'GSP-23941', uni: 'Abertay University', status: 'Submitted to university', on: 'University', what: 'A decision', since: 120, left: -30 },
  { id: 'w7', student: 'Aarav Shah', ref: 'GSP-24110', uni: 'Deakin University', status: 'Deposit pending', on: 'RP', what: 'Deposit receipt', since: 18, left: 45 },
  { id: 'w8', student: 'Nguyen Thi Lan', ref: 'GSP-24088', uni: 'Flinders University', status: 'Interview requested', on: 'University', what: 'Interview date', since: 14, left: 13 },
  { id: 'w9', student: 'Tanvir Ahmed', ref: 'GSP-24071', uni: 'Coventry University', status: 'Document re-upload pending', on: 'RP', what: 'Passport, clearer scan', since: 30, left: 6 },
  { id: 'w10', student: 'Sujan Karki', ref: 'GSP-24066', uni: 'University of Wollongong', status: 'Conditional offer, conditions pending', on: 'RP', what: 'IELTS result', since: 54, left: 99 },
  { id: 'w11', student: 'Ayesha Khan', ref: 'GSP-24049', uni: 'University of Newcastle', status: 'Awaiting CoE', on: 'University', what: 'Confirmation of enrolment', since: 40, left: 23 },
  { id: 'w12', student: 'Meera Nair', ref: 'GSP-24120', uni: 'Abertay University', status: 'Pending verification', on: 'RP', what: 'Statement of purpose', since: 5, left: null },
];
