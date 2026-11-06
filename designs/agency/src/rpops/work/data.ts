/**
 * My work in GSP · RP Ops (Nesil, 5 Nov; after the reference): this role's own copy of GSP · Admissions' My work.
 * The RP Ops queue (led by Leena Thomas, as in GSP · Admin's Queues) works recruitment partners: documents,
 * agreements, check-ins and changes. As in the reference, nothing is assigned to the signed-in person yet and nothing
 * waits on others; the team has 16 open tasks. Times are working hours (9 a working day), as at 5 Nov 2026, 2:15 pm IST.
 */
export type RwTask = { id: string; title: string; kind: string; rp: string; region: string; queue: string; assignee: string; waited: number; sla: number; escalated?: string; paused?: string; done?: boolean };

export const QUEUE = 'RP Ops';
export const LEADER = 'Leena Thomas';
export const TEAM = [LEADER, 'Garima Bhardwaj', 'Rohan Desai', 'Nisha Kapoor'];

export type Standing = 'track' | 'soon' | 'late' | 'paused' | 'done';
export const STANDING: Record<Standing, string> = { track: 'On track', soon: 'Due soon', late: 'Breached', paused: 'Paused', done: 'Completed' };
export const standingOf = (t: RwTask): Standing => {
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

const t = (id: string, title: string, kind: string, rp: string, region: string, assignee: string, waited: number, sla: number, o: Partial<RwTask> = {}): RwTask => ({ id, title, kind, rp, region, queue: QUEUE, assignee, waited, sla, ...o });
export const sampleRwTasks = (): RwTask[] => [
  t('r1', 'Check in with Educareer Services', 'RP lifecycle change', 'Educareer Services', 'India', 'Garima Bhardwaj', 90, 27, { escalated: 'Admin' }),
  t('r2', 'Check in with GSP test agency', 'RP lifecycle change', 'GSP test agency', 'India', 'Nisha Kapoor', 72, 27, { escalated: 'Admin' }),
  t('r3', 'Check in with IEMC Global', 'RP lifecycle change', 'IEMC Global', 'Vietnam', 'Garima Bhardwaj', 63, 27, { escalated: 'Admin' }),
  t('r4', 'Check in with Visafast Migration', 'RP lifecycle change', 'Visafast Migration', 'Australia', 'Leena Thomas', 54, 27, { escalated: 'Admin' }),
  t('r5', 'Verify Nikee Business Group’s documents', 'Verify an RP’s documents', 'Nikee Business Group', 'Australia', 'Nisha Kapoor', 30, 9, { escalated: 'Admin' }),
  t('r6', 'Check AGS Advance Global Study’s signed agreement', 'Check a signed RP agreement', 'AGS Advance Global Study', 'India', 'Garima Bhardwaj', 20, 9),
  t('r7', 'Re-verify BrightPath Overseas’s documents', 'Re-verify agency documents', 'BrightPath Overseas', 'India', 'Nisha Kapoor', 24, 18),
  t('r8', 'Verify Global Pathways Nepal’s documents', 'Verify an RP’s documents', 'Global Pathways Nepal', 'Nepal', 'Leena Thomas', 14, 9),
  t('r9', 'Change Edulink Dhaka’s bank details', 'Change agency details', 'Edulink Dhaka', 'Bangladesh', 'Garima Bhardwaj', 12, 9),
  t('r10', 'Check Saigon Study Hub’s signed agreement', 'Check a signed RP agreement', 'Saigon Study Hub', 'Vietnam', 'Nisha Kapoor', 8, 9),
  t('r11', 'Verify Lanka Edu Partners’ documents', 'Verify an RP’s documents', 'Lanka Edu Partners', 'Sri Lanka', 'Garima Bhardwaj', 3, 9, { paused: 'Trade licence, clearer scan' }),
  t('r12', 'Re-verify Unimate Pune’s documents', 'Re-verify agency documents', 'Unimate Pune', 'India', 'Leena Thomas', 6, 18),
  t('r13', 'Change Kathmandu Consult’s address', 'Change agency details', 'Kathmandu Consult', 'Nepal', 'Nisha Kapoor', 2, 9),
  t('r14', 'Verify Mekong Education’s documents', 'Verify an RP’s documents', 'Mekong Education', 'Vietnam', '', 2, 9),
  t('r15', 'Check Lahore Learning’s signed agreement', 'Check a signed RP agreement', 'Lahore Learning', 'Pakistan', '', 1, 9),
  t('r16', 'Verify Accra Abroad’s documents', 'Verify an RP’s documents', 'Accra Abroad', 'Africa', 'Garima Bhardwaj', 4, 9, { paused: 'Director’s ID' }),
];
