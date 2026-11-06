/**
 * My work in GSP · Institution (Nesil, 5 Nov; after the reference): this role's own copy of GSP · RP Ops' My work.
 * The Institution queue (led by Lalaine Dizon) works institution partners: agreements, course data and go-lives. As in
 * the reference, nothing is assigned to the signed-in person and nothing waits on others; the team has 4 open tasks,
 * 2 breached. Times are working hours (9 a working day), as at 5 Nov 2026, 2:15 pm IST.
 */
export type IwTask = { id: string; title: string; kind: string; rp: string; region: string; queue: string; assignee: string; waited: number; sla: number; escalated?: string; paused?: string; done?: boolean };

export const QUEUE = 'Institution';
export const LEADER = 'Lalaine Dizon';
export const TEAM = [LEADER, 'Namita Nath', 'Raj Shamani', 'Kavya Menon'];

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
  t('i1', 'Renew the agreement with Massey University', 'Renew an agreement', 'Massey University', 'Global', 'Lalaine Dizon', 405, 270, { escalated: 'Admin' }),
  t('i2', 'Renew the agreement with Lincoln University', 'Renew an agreement', 'Lincoln University', 'Global', 'Lalaine Dizon', 300, 270),
  t('i3', 'Update course data for University of Canterbury', 'Course data update', 'University of Canterbury', 'Global', 'Namita Nath', 18, 45),
  t('i4', 'Get Victoria University live', 'Get a university live', 'Victoria University', 'Global', 'Kavya Menon', 27, 90),
];
