/**
 * My work in GSP · Finance (Nesil, 6 Nov): GSP · Institution's My work, this role's own copy, with the Finance queue
 * (led by Suman Verma): commission claims, invoices to universities, remittances to match and payouts to recruitment
 * partners. Rhythm Jain, signed in, has three; times are working hours (9 a working day), as at 5 Nov 2026, 2:15 pm IST.
 */
export type IwTask = { id: string; title: string; kind: string; rp: string; region: string; queue: string; assignee: string; waited: number; sla: number; escalated?: string; paused?: string; done?: boolean };

export const QUEUE = 'Finance';
export const LEADER = 'Suman Verma';
export const TEAM = [LEADER, 'Rhythm Jain', 'Pallavi Thakur', 'Nandini Sharma'];

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
  t('f1', 'Check the commission claim from BrightPath Overseas', 'Check a commission claim', 'BrightPath Overseas', 'India', 'Rhythm Jain', 12, 18),
  t('f2', 'Raise the Semester 2 invoice to Deakin University', 'Raise an invoice', 'Deakin University', 'Global', 'Rhythm Jain', 20, 27),
  t('f3', 'Match the Flinders remittance to its invoices', 'Match a remittance', 'Flinders University', 'Global', 'Rhythm Jain', 31, 27),
  t('f4', 'Approve the October payout to Lotus Study Abroad', 'Approve an RP payout', 'Lotus Study Abroad', 'India', 'Pallavi Thakur', 9, 18),
  t('f5', 'Chase the overdue invoice INV-2026-0418', 'Chase an overdue invoice', 'Coventry University', 'Global', 'Nandini Sharma', 52, 45, { escalated: 'Admin' }),
  t('f6', 'Correct the invoice for two withdrawn students', 'Correct an invoice', 'Coventry University', 'Global', '', 4, 27),
];
