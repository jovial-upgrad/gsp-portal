/**
 * My work in GSP · Global Ops (Nesil, 6 Nov): GSP · Institution's My work, this role's own copy, with the Global Ops
 * queue (led by Karan Malhotra): applications stuck on the way, university submission details, scholarships, course
 * rules and announcements. Neha Kulkarni, signed in, has three; times are working hours (9 a working day).
 */
export type IwTask = { id: string; title: string; kind: string; rp: string; region: string; queue: string; assignee: string; waited: number; sla: number; escalated?: string; paused?: string; done?: boolean };

export const QUEUE = 'Global Ops';
export const LEADER = 'Karan Malhotra';
export const TEAM = [LEADER, 'Neha Kulkarni', 'Ishita Rao', 'Vikram Shetty'];

export type Standing = 'track' | 'soon' | 'late' | 'paused' | 'done';
export const STANDING: Record<Standing, string> = { track: 'On track', soon: 'Due soon', late: 'Breached', paused: 'Paused', done: 'Completed' };
export const standingOf = (t: IwTask): Standing => {
  if (t.done) return 'done';
  if (t.paused) return 'paused';
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

const t = (id: string, title: string, kind: string, rp: string, region: string, assignee: string, waited: number, sla: number, o: Partial<IwTask> = {}): IwTask => ({ id, title, kind, rp, region, queue: QUEUE, assignee, waited, sla, ...o });
export const sampleIwTasks = (): IwTask[] => [
  t('g1', 'Unstick Rohan Gupta’s application at submission', 'Unstick an application', 'Northumbria University', 'Global', 'Neha Kulkarni', 10, 18),
  t('g2', 'Update Deakin University’s submission contacts', 'Update submission details', 'Deakin University', 'Global', 'Neha Kulkarni', 22, 27),
  t('g3', 'Fix the English rules for the Flinders MBA', 'Fix course rules', 'Flinders University', 'Global', 'Neha Kulkarni', 30, 27),
  t('g4', 'Check the Flinders Nursing scholarship', 'Check a scholarship', 'Flinders University', 'Global', 'Ishita Rao', 6, 18),
  t('g5', 'Publish the Coventry January intake dates', 'Publish an announcement', 'Coventry University', 'Global', 'Vikram Shetty', 48, 45, { escalated: 'Admin' }),
  t('g6', 'Answer BrightPath Overseas’ escalation', 'Answer an RP escalation', 'BrightPath Overseas', 'India', '', 3, 9),
];
