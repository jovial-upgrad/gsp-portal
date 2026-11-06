/**
 * Work (Nesil, 5 Nov; the PM's Queues and Task rules): where each kind of work goes and what it's due in, the working
 * time every SLA counts on, who's told when a task is late, and the tasks the system creates on its own. Sample data.
 *
 * The chain: a **task rule** (or a person's request, or an application reaching a stage) makes a task of one **kind of
 * work**; the kind says which **queue** it lands in and its **SLA**; the queue says **how it's shared** among its
 * members; **reminders and escalation** follow the SLA, counted in **working time** (IST).
 */

/** How a queue shares its work. */
export type Sharing = 'fewest' | 'owner' | 'pick' | 'leader';
export const SHARING: Record<Sharing, { label: string; hint: string }> = {
  fewest: { label: 'Fewest open', hint: 'Each task goes to the member with the fewest open tasks here.' },
  owner: { label: 'Record owner', hint: 'Each task goes to whoever owns the record, like the RP’s BDM.' },
  pick: { label: 'Members pick', hint: 'Tasks wait in the queue until a member takes one.' },
  leader: { label: 'Leader assigns', hint: 'The leader gives each task to someone.' },
};
export type QueueType = 'Admissions' | 'Recruitment' | 'Team';
export const QUEUE_TYPES: QueueType[] = ['Admissions', 'Recruitment', 'Team'];

/** Where a kind of work goes: a queue's id, or each sales region's own Admissions or Recruitment queue. */
export type Destination = string;
export const REGION_ADMISSIONS = 'region:Admissions';
export const REGION_RECRUITMENT = 'region:Recruitment';

export const AREAS = ['Applications', 'Recruitment partners', 'Institutions and courses', 'Finance', 'System'] as const;
export type Area = (typeof AREAS)[number];
export type DueUnit = 'hours' | 'days';
/** A kind of work: what it is, the queue it lands in, and its SLA in working time. */
export type WorkKind = { id: string; name: string; area: Area; to: Destination; due: number; unit: DueUnit };

export const dueText = (n: number, unit: DueUnit) => `${n} working ${unit === 'hours' ? (n === 1 ? 'hour' : 'hours') : n === 1 ? 'day' : 'days'}`;

const k = (id: string, name: string, area: Area, to: Destination, due: number, unit: DueUnit = 'days'): WorkKind => ({ id, name, area, to, due, unit });
/** The 21 kinds of work (sample), by area. Team queues are named by id: see `sampleQueues` in config.ts. */
export const sampleKinds = (): WorkKind[] => [
  k('k-verify', 'Verify application documents', 'Applications', REGION_ADMISSIONS, 1),
  k('k-submit', 'Submit to the university', 'Applications', REGION_ADMISSIONS, 1),
  k('k-decision', 'Record the university’s decision', 'Applications', REGION_ADMISSIONS, 2),
  k('k-conditions', 'Check offer conditions', 'Applications', REGION_ADMISSIONS, 2),
  k('k-deposit', 'Confirm the deposit', 'Applications', REGION_ADMISSIONS, 1),
  k('k-refund', 'Process a refund', 'Applications', REGION_ADMISSIONS, 3),
  k('k-chat', 'Answer a handed-over chat', 'Applications', REGION_ADMISSIONS, 4, 'hours'),
  k('k-escalated', 'Sort out an escalated application', 'Applications', 'q-admission-ops', 1),
  k('k-rpdocs', 'Verify an RP’s documents', 'Recruitment partners', 'q-rp-ops', 1),
  k('k-rpagr', 'Check a signed RP agreement', 'Recruitment partners', 'q-rp-ops', 1),
  k('k-rpreverify', 'Re-verify agency documents', 'Recruitment partners', 'q-rp-ops', 2),
  k('k-rpsignup', 'Contact an RP to finish sign-up', 'Recruitment partners', REGION_RECRUITMENT, 2),
  k('k-rpquiet', 'Follow up a quiet RP', 'Recruitment partners', REGION_RECRUITMENT, 5),
  k('k-unilive', 'Get a university live', 'Institutions and courses', 'q-ip-ops', 10),
  k('k-coursedata', 'Course data update', 'Institutions and courses', 'q-ip-ops', 5),
  k('k-iprenew', 'Renew an IP agreement', 'Institutions and courses', 'q-ip-ops', 30),
  k('k-commission', 'Enter commission terms', 'Finance', 'q-finance', 2),
  k('k-change', 'Check a change', 'Finance', 'q-finance', 2),
  k('k-invoice', 'Answer an invoice query', 'Finance', 'q-finance', 3),
  k('k-payout', 'Approve a payout', 'Finance', 'q-finance', 2),
  k('k-system', 'Fix a setting or a failed job', 'System', 'q-admin', 1),
];

/** The working week (Monday first) and hours every SLA counts on, in IST. */
export type Week = { days: boolean[]; from: string; to: string };
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export type Holiday = { id: string; date: string; name: string };
/**
 * A working calendar (Nesil, 5 Nov, after the reference screens): its working days and hours (always IST: one time
 * zone for everything), the sales regions on it and its own holidays. A region is on one calendar; a record's SLA
 * counts its region's calendar. The first is the default: a record with no region, or a region on no calendar, uses it.
 */
export type Calendar = Week & { id: string; name: string; regions: string[]; holidays: Holiday[] };
export const sampleCalendars = (regions: string[]): Calendar[] => [
  {
    id: 'cal-monfri',
    name: 'Monday to Friday',
    days: [true, true, true, true, true, false, false],
    from: '09:30',
    to: '18:30',
    regions: regions.filter((r) => r !== 'Bangladesh'),
    holidays: [
      { id: 'h1', date: '2026-11-08', name: 'Diwali' },
      { id: 'h2', date: '2026-12-25', name: 'Christmas' },
      { id: 'h3', date: '2027-01-01', name: 'New Year’s Day' },
      { id: 'h4', date: '2027-01-26', name: 'Republic Day' },
    ],
  },
  {
    id: 'cal-sunthu',
    name: 'Sunday to Thursday',
    days: [true, true, true, true, false, false, true],
    from: '09:30',
    to: '18:30',
    regions: ['Bangladesh'],
    holidays: [
      { id: 'h5', date: '2026-12-16', name: 'Victory Day' },
      { id: 'h6', date: '2026-12-25', name: 'Christmas' },
    ],
  },
];
/** Working hours a day; a day that ends before it starts runs past midnight. */
export const dayHours = (from: string, to: string) => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const d = (m(to) - m(from) + 1440) % 1440;
  return Math.round((d / 60) * 10) / 10;
};
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** "Mon–Fri", "Sun–Thu", or the days listed, reading the week round from any day. */
export const daysShort = (days: boolean[]) => {
  const n = days.filter(Boolean).length;
  if (!n) return 'No working days';
  if (n === 7) return 'Every day';
  // a run that wraps the week (Sun–Thu): start after an off day
  for (let s = 0; s < 7; s++) {
    if (!days[s] || days[(s + 6) % 7]) continue;
    let k = 0;
    while (k < 7 && days[(s + k) % 7]) k++;
    if (k === n) return n === 1 ? SHORT[s] : `${SHORT[s]}–${SHORT[(s + n - 1) % 7]}`;
  }
  return SHORT.filter((_, i) => days[i]).join(', ');
};
/** "Monday to Friday", or the days listed. */
export const weekText = (days: boolean[]) => {
  const on = WEEKDAYS.filter((_, i) => days[i]);
  const run = days.findIndex((d) => d) >= 0 && on.length > 1 && on.every((d) => days[WEEKDAYS.indexOf(d)]) && WEEKDAYS.indexOf(on[on.length - 1]) - WEEKDAYS.indexOf(on[0]) === on.length - 1;
  return !on.length ? 'No working days' : run ? `${on[0]} to ${on[on.length - 1]}` : on.join(', ');
};

/**
 * Reminders and escalation, the same for every queue (5 Nov, later, after the reference): the reminder's working days
 * before due (only on tasks with an SLA of 2 working days or more), level 1 at the due time, levels 2 and 3 after so
 * many working days late, and the morning email's time (IST).
 */
export type Ladder = { soon: number; l2: number; l3: number; mail: string };
export const sampleLadder = (): Ladder => ({ soon: 1, l2: 2, l3: 5, mail: '08:30' });

/** A rule's times: working hours, working days or calendar days (the reference's three units). */
export type SpanUnit = 'hours' | 'days' | 'calendar';
export const SPAN_UNITS: Record<SpanUnit, string> = { hours: 'working hours', days: 'working days', calendar: 'calendar days' };
export type Span = { n: number; unit: SpanUnit } | null;
/** "4 wh", "2 wd", "30 days": short, for the table. */
export const spanShort = (x: Span) => (!x ? '—' : x.unit === 'hours' ? `${x.n} wh` : x.unit === 'days' ? `${x.n} wd` : `${x.n} ${x.n === 1 ? 'day' : 'days'}`);
/** "4 working hours", "30 calendar days". */
export const spanText = (x: Span) => (!x ? '' : `${x.n} ${x.unit === 'calendar' ? (x.n === 1 ? 'calendar day' : 'calendar days') : `working ${x.unit === 'hours' ? (x.n === 1 ? 'hour' : 'hours') : x.n === 1 ? 'day' : 'days'}`}`);
/** How a rule's tasks are shared: to the application's officer, the queue's own way, or one of the queue methods. */
export type RuleSharing = 'officer' | 'queue' | Sharing;
export const RULE_SHARING: Record<RuleSharing, string> = { officer: 'The application’s officer', queue: 'The queue’s own way', fewest: 'Fewest open', owner: 'Record owner', leader: 'To the leader', pick: 'Members pick' };
export const RULE_CATS = ['Applications', 'RPs', 'Institution partners', 'Email', 'Commission', 'Admin', 'Escalation'] as const;
export type RuleCat = (typeof RULE_CATS)[number];
/**
 * A task rule (Nesil, 5 Nov, later; after the reference's Task rules): what it watches (**when**), how long that must
 * hold before its task starts (**after**), the task people see, its kind of work (so its queue), its own **SLA** (empty:
 * its kind of work's), when the RP is reminded, how it's shared (empty: as its queue), and when it closes on its own.
 * When, the task, the kind and when it closes are built in; the rest can change. Sample rules, for Jovial to confirm.
 */
export type TaskRule = { id: string; code: string; cat: RuleCat; name: string; on: boolean; fixed?: boolean; when: string; after: Span; task: string; kind: string; sla: Span; remind: Span; sharing: RuleSharing; closes: string };
const h = (n: number): Span => ({ n, unit: 'hours' });
const d = (n: number): Span => ({ n, unit: 'days' });
let seq = 0;
const r = (cat: RuleCat, name: string, when: string, task: string, kind: string, closes: string, o: Partial<Pick<TaskRule, 'after' | 'sla' | 'remind' | 'sharing' | 'on' | 'fixed'>> = {}): TaskRule => {
  seq += 1;
  return { id: `tr-${seq}`, code: `T${seq}`, cat, name, on: o.on ?? true, fixed: o.fixed, when, after: o.after ?? null, task, kind, sla: o.sla ?? null, remind: o.remind ?? null, sharing: o.sharing ?? 'queue', closes };
};
export const sampleRules = (): TaskRule[] => {
  seq = 0;
  return [
    r('Applications', 'Documents to verify', 'Status is Pending verification', 'Verify the documents for [student]', 'k-verify', 'The status changes', { sla: h(1), sharing: 'officer' }),
    r('Applications', 'New documents from the RP', 'The RP sent documents GSP hasn’t checked', 'Check the documents the RP sent for [student]', 'k-verify', 'Every document is verified or sent back', { sla: h(1), sharing: 'officer' }),
    r('Applications', 'Unread message from the RP', 'The RP sent a message the officer hasn’t seen', 'Reply to the RP on [student]', 'k-chat', 'The officer opens the application', { sla: h(1), sharing: 'officer' }),
    r('Applications', 'Re-upload is late', 'A sent-back document isn’t re-uploaded', 'Chase the RP: the re-upload for [student] is late', 'k-verify', 'The RP re-uploads, or the status changes', { after: h(48), sla: h(6), remind: h(24), sharing: 'officer' }),
    r('Applications', 'Ready to submit', 'Status is Ready to submit', 'Submit [student] to [university]', 'k-submit', 'The status moves to Submitted to university', { sla: h(1), sharing: 'officer' }),
    r('Applications', 'No decision yet', 'Submitted, with no decision from the university', 'Chase [university] for a decision on [student]', 'k-decision', 'The decision is recorded', { after: d(10), sharing: 'officer' }),
    r('Applications', 'Conditional offer', 'A conditional offer arrives', 'Check the offer conditions for [student]', 'k-conditions', 'Every condition is met or waived', { remind: d(3), sharing: 'officer' }),
    r('Applications', 'Payment proof', 'The RP uploads a deposit or tuition receipt', 'Confirm the payment for [student]', 'k-deposit', 'The payment is confirmed or sent back', { sharing: 'officer' }),
    r('Applications', 'Refund asked for', 'The RP asks for a refund', 'Process the refund for [student]', 'k-refund', 'The refund is paid, or refused with a reason', { sharing: 'officer' }),
    r('Applications', 'Stuck application', 'The status hasn’t changed', 'Move [student]’s application on', 'k-escalated', 'The status changes', { after: d(15) }),
    r('RPs', 'Sign-up not finished', 'Registered and not activated', 'Contact [RP] to finish sign-up', 'k-rpsignup', 'The RP is activated, or marked Not interested', { after: d(3), remind: d(2) }),
    r('RPs', 'Documents sent', 'An RP sends its onboarding documents', 'Verify [RP]’s documents', 'k-rpdocs', 'Every document is verified or sent back'),
    r('RPs', 'Signed agreement', 'An RP uploads its signed agreement', 'Check [RP]’s signed agreement', 'k-rpagr', 'The agreement is accepted or sent back'),
    r('RPs', 'Document expiring', 'An RP document expires soon', 'Re-verify [RP]’s documents', 'k-rpreverify', 'A new document is verified', { after: { n: 30, unit: 'calendar' }, remind: d(10) }),
    r('RPs', 'Quiet RP', 'An active RP sends no new application', 'Follow up [RP]', 'k-rpquiet', 'The RP sends an application, or the BDM logs a reason', { after: { n: 30, unit: 'calendar' }, sharing: 'owner' }),
    r('Institution partners', 'Agreement ends soon', 'An IP agreement ends in 60 days', 'Renew the agreement with [IP]', 'k-iprenew', 'A new agreement is uploaded'),
    r('Institution partners', 'Course review due', 'A university’s course review is due in 14 days', 'Update course data for [university]', 'k-coursedata', 'The courses are checked'),
    r('Institution partners', 'New university', 'A new university is signed', 'Get [university] live', 'k-unilive', 'The university is live in course search'),
    r('Email', 'Unmatched email', 'A university email can’t be placed on an application', 'Place the email from [sender]', 'k-escalated', 'The email is placed or dismissed', { sla: h(9) }),
    r('Email', 'Email matched', 'An email is matched to an application (90% or more)', 'Act on the email for [student]', 'k-decision', 'The officer files or dismisses the email', { sla: h(1), sharing: 'officer' }),
    r('Email', 'Interview asked for', 'An email asks for an interview or a GS assessment', 'Book the interview for [student]', 'k-conditions', 'The interview is booked', { sla: h(9), sharing: 'officer' }),
    r('Commission', 'Remittance received', 'A remittance or statement arrives at the commissions inbox', 'Match the remittance against commissions', 'k-change', 'It’s matched to invoices', { sla: h(24) }),
    r('Commission', 'Commission terms missing', 'An agreement is uploaded and no terms are entered', 'Enter commission terms for [partner]', 'k-commission', 'The terms are entered and checked', { sla: h(18) }),
    r('Commission', 'Rule changed', 'A commission rule is drafted or changed', 'Check the change to [rule]', 'k-change', 'A second person approves or rejects it', { sla: h(9) }),
    r('Commission', 'Invoice query', 'An RP queries a statement', 'Answer [RP]’s query', 'k-invoice', 'The query is answered'),
    r('Commission', 'Payout ready', 'The weekly payout run is ready', 'Approve this week’s payout', 'k-payout', 'The payout is approved'),
    r('Admin', 'Failed job', 'A scheduled job fails', 'Fix the failed job: [job]', 'k-system', 'The job runs'),
    r('Admin', 'Inbox not syncing', 'A shared inbox stops syncing', 'Reconnect [inbox]', 'k-system', 'The inbox syncs again', { sla: h(4) }),
    r('Admin', 'Exchange rates missing', 'Friday 1 am IST, and next week has no exchange rates', 'Enter next week’s exchange rates', 'k-system', 'The rates are saved', { sla: h(9), sharing: 'leader' }),
    r('Admin', 'Rate missing for a date', 'A commission line uses a currency with no rate for its date', 'Add a rate for [currency] from [date]', 'k-system', 'The rate is saved', { sla: h(9), sharing: 'leader' }),
    r('Escalation', 'Late task', 'A task is past its due time (Reminders and Escalation)', 'No new task: the same task is shown to more people', 'k-escalated', 'The task is done', { fixed: true }),
  ];
};

/** Requests people can raise from a record, by the queue they go to (each region's Recruitment queue, or a team's). */
export type RequestList = { to: Destination; types: string[] };
export const sampleRequests = (): RequestList[] => [
  { to: 'q-ip-ops', types: ['Update IP contacts', 'Check agreement terms', 'Update courses', 'Add a new course', 'Fix a course error'] },
  { to: 'q-finance', types: ['Enter commission details', 'Invoice query'] },
  { to: 'q-rp-ops', types: ['Re-verify agency documents', 'Change agency details'] },
  { to: REGION_RECRUITMENT, types: ['Contact this RP'] },
  { to: 'q-admission-ops', types: ['Escalate an application issue'] },
];
