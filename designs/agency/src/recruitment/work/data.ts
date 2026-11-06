/**
 * My work in GSP · Recruitment (Nesil, 6 Nov): GSP · Institution's My work, this role's own copy, with the Recruitment
 * queue (led by Saurabh, the Recruitment Head): partner check-ins, branches and teams to set up, onboarding to chase.
 * Aditya Rao, signed in, has three; times are working hours (9 a working day).
 */
export type IwTask = { id: string; title: string; kind: string; rp: string; region: string; queue: string; assignee: string; waited: number; sla: number; escalated?: string; paused?: string; done?: boolean };

export const QUEUE = 'Recruitment';
export const LEADER = 'Saurabh';
export const TEAM = [LEADER, 'Aditya Rao', 'Nadia', 'Harsh'];

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
  t('r1', 'Check in with BrightPath Overseas after its first month', 'Partner check-in', 'BrightPath Overseas', 'India', 'Aditya Rao', 8, 18),
  t('r2', 'Add Lotus Study Abroad’s new Pune branch', 'Set up a branch', 'Lotus Study Abroad', 'India', 'Aditya Rao', 20, 27),
  t('r3', 'Chase Horizon Overseas’ onboarding documents', 'Chase onboarding', 'Horizon Overseas', 'India', 'Aditya Rao', 31, 27),
  t('r4', 'Add two counsellors to Edulink Dhaka’s team', 'Update a team', 'Edulink Dhaka', 'Bangladesh', 'Nadia', 5, 18),
  t('r5', 'Plan the Bengaluru agency visits', 'Plan visits', 'Bengaluru agencies', 'India', 'Harsh', 50, 45, { escalated: 'Admin' }),
  t('r6', 'Follow up a new agency enquiry from Kochi', 'New agency enquiry', 'Kochi Study Hub', 'India', '', 3, 9),
];
