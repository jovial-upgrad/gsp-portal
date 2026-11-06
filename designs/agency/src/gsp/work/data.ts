/**
 * My work in GSP · Admissions (Nesil, 5 Nov; after the reference's Admissions work page): this role's own copy, so a
 * change here never reaches GSP · Admin's My Work. Freddy Forrest (signed in) is an Admissions officer in the India
 * Admissions queue, led by Ramish. Sample tasks on applications, timed as at Thursday 5 Nov 2026, 2:15 pm IST, in
 * working hours (9 a working day, Monday to Friday).
 */
export type GwTask = { id: string; title: string; kind: string; ref: string; uni: string; region: string; queue: string; assignee: string; waited: number; sla: number; escalated?: string; paused?: string; done?: boolean };
export type GwWait = { id: string; student: string; ref: string; uni: string; status: string; on: 'RP' | 'University'; what: string; since: number; left: number | null };

export const ME = 'Freddy Forrest';
export const QUEUE = 'India Admissions';
export const LEADER = 'Ramish';
export const TEAM = [LEADER, ME, 'Alfiya Khan', 'Anand Mishra', 'Prachi Pilani', 'Sakshi Shashi', 'Piyush Varshney'];

export type Standing = 'track' | 'soon' | 'late' | 'paused' | 'done';
export const STANDING: Record<Standing, string> = { track: 'On track', soon: 'Due soon', late: 'Breached', paused: 'Paused', done: 'Completed' };
export const standingOf = (t: GwTask): Standing => {
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

const t = (id: string, title: string, kind: string, ref: string, uni: string, assignee: string, waited: number, sla: number, o: Partial<GwTask> = {}): GwTask => ({ id, title, kind, ref, uni, region: 'India', queue: QUEUE, assignee, waited, sla, ...o });
export const sampleGwTasks = (): GwTask[] => [
  // Freddy's own: 12
  t('g1', 'Chase University of Wollongong for a decision on Priya Raman', 'Chase the university', 'GSP-24097', 'University of Wollongong', ME, 63, 27, { escalated: 'Admission Ops' }),
  t('g2', 'Confirm Arjun Sharma’s enrolment with Southern Cross University', 'Confirm enrolment', 'GSP-24202', 'Southern Cross University', ME, 72, 45, { escalated: 'Admission Ops' }),
  t('g3', 'Check the payment proof for Rohan Patel', 'Check payment proof', 'GSP-24204', 'University of the West of Scotland', ME, 45, 18, { escalated: 'Admission Ops' }),
  t('g4', 'Submit Kavya Iyer to Coventry University', 'Submit to the university', 'GSP-24211', 'Coventry University', ME, 14, 9),
  t('g5', 'Record Abertay University’s decision on Aarav Shah', 'Record the university’s decision', 'GSP-24110', 'Abertay University', ME, 21, 18),
  t('g6', 'Answer the RP on Meera Nair', 'Answer a handed-over chat', 'GSP-24120', 'Abertay University', ME, 3, 4),
  t('g7', 'Check the offer conditions for Ayesha Khan', 'Check offer conditions', 'GSP-24049', 'University of Newcastle', ME, 10, 18),
  t('g8', 'Verify the documents for Sneha Patil', 'Verify application documents', 'GSP-24055', 'Flinders University', ME, 2, 9, { paused: 'Gap explanation document' }),
  t('g9', 'Check the 12th marksheet the RP sent for Rohan Nair', 'Verify application documents', 'GSP-24209', 'University of Wales Trinity Saint David', ME, 9, 9, { paused: '12th marksheet' }),
  t('g10', 'Chase the RP: offer conditions for Priya Raman', 'File a university email', 'GSP-24102', 'Deakin University', ME, 1, 18),
  t('g11', 'Confirm the deposit for Tanvir Ahmed', 'Confirm the deposit', 'GSP-24071', 'Coventry University', ME, 2, 9),
  t('g12', 'Process the refund for Sujan Karki', 'Process a refund', 'GSP-24066', 'University of Wollongong', ME, 4, 27),
  // the rest of the team: 8, two not assigned
  t('g13', 'Verify the documents for Ishita Rao', 'Verify application documents', 'GSP-24215', 'Deakin University', 'Alfiya Khan', 12, 9),
  t('g14', 'Submit Dev Malhotra to Flinders University', 'Submit to the university', 'GSP-24216', 'Flinders University', 'Anand Mishra', 4, 9),
  t('g15', 'Check the offer conditions for Nisha Verma', 'Check offer conditions', 'GSP-24218', 'University of Newcastle', 'Prachi Pilani', 20, 18),
  t('g16', 'Confirm the deposit for Kabir Joshi', 'Confirm the deposit', 'GSP-24219', 'Coventry University', 'Sakshi Shashi', 3, 9),
  t('g17', 'Answer the RP on Ananya Gupta', 'Answer a handed-over chat', 'GSP-24220', 'Abertay University', 'Piyush Varshney', 1, 4),
  t('g18', 'Record Deakin University’s decision on Vikram Singh', 'Record the university’s decision', 'GSP-24221', 'Deakin University', LEADER, 6, 18),
  t('g19', 'Verify the documents for Riya Menon', 'Verify application documents', 'GSP-24222', 'University of Wollongong', '', 2, 9),
  t('g20', 'Submit Aditya Kulkarni to Southern Cross University', 'Submit to the university', 'GSP-24223', 'Southern Cross University', '', 1, 9),
  // completed earlier today
  t('g21', 'Verify the documents for Pooja Desai', 'Verify application documents', 'GSP-24190', 'Flinders University', ME, 5, 9, { done: true }),
];

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
